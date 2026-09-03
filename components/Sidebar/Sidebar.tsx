"use client";

import { BarChart3Icon, FilmIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsBelowBreakpoint } from "@/lib/hooks/useIsBelowBreakpoint";
import { cn } from "@/lib/utils";
import { SidebarNavLink } from "@/components/Sidebar/components/links/SidebarNavLink";
import { SidebarRailToggle } from "@/components/Sidebar/components/toggles/SidebarRailToggle";
import { SidebarScrim } from "@/components/Sidebar/components/scrims/SidebarScrim";
import { SIDEBAR_NAV_ID } from "@/components/Sidebar/constants";
import { getTrapFocusTarget } from "@/components/Sidebar/helpers";
import type { SidebarProps } from "@/components/Sidebar/types";

/**
 * App sidebar. Below `lg` (1024px) it is a two-state rail on a single axis:
 * COMPACT (64px icon-only, pushes `main` via `pl-16`, plain `<nav>`
 * landmark, background fully interactive) and EXPANDED (256px `fixed`
 * overlay with a scrim, `role="dialog" aria-modal="true"`, background
 * `inert`/`aria-hidden`). At `lg` and above the rail is a persistent 256px
 * panel, byte-identical to before this rail existed.
 *
 * Geometry (rail/`main` widths, push vs. overlay) is driven entirely by
 * Tailwind `lg:` variants so desktop layout can never depend on JavaScript
 * state. `useIsBelowBreakpoint("lg")` gates semantics only (dialog role,
 * `inert`, the focus trap) — see TDD #284 §5.2 for why that split matters:
 * driving geometry from JS state instead would let an EXPANDED overlay
 * opened below `lg` survive a resize past `lg` and leave the entire desktop
 * app `inert`.
 *
 * No persistence of any kind (no `localStorage`/`sessionStorage`/cookie).
 * `isExpanded` always starts `false` and resets to `false` whenever the
 * viewport crosses back above `lg`, so a hard reload or a resize always
 * lands on the breakpoint default.
 */
export function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname();
  const isBelowLg = useIsBelowBreakpoint("lg");
  const [isExpanded, setIsExpanded] = useState(false);
  // Resets `isExpanded` to COMPACT the moment the viewport crosses back
  // above `lg`, so a later resize back down never resurrects a stale
  // EXPANDED state (TDD #284 §5.1). Adjusted during render rather than in
  // an effect — the React-recommended pattern for "reset state when a
  // value changes" — so there is no extra commit/paint where a resize-up
  // could observe a stale EXPANDED state before an effect gets to run.
  const [prevIsBelowLg, setPrevIsBelowLg] = useState(isBelowLg);
  if (isBelowLg !== prevIsBelowLg) {
    setPrevIsBelowLg(isBelowLg);
    if (!isBelowLg) {
      setIsExpanded(false);
    }
  }

  const isModal = isBelowLg && isExpanded;

  const asideRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isFirstFocusEffect = useRef(true);

  // Restores focus to the toggle on every isExpanded transition — covers
  // expand (spec: focus moves to the toggle) and every collapse route
  // (toggle click, scrim click, Esc) in one place, per TDD #284 §5.4. Skips
  // the very first render so mount never steals focus.
  useEffect(() => {
    if (isFirstFocusEffect.current) {
      isFirstFocusEffect.current = false;
      return;
    }
    toggleRef.current?.focus();
  }, [isExpanded]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const handleToggle = useCallback(() => {
    setIsExpanded((previous) => !previous);
  }, []);

  useEffect(() => {
    if (!isModal) {
      return;
    }

    const asideEl = asideRef.current;
    if (!asideEl) {
      return;
    }

    const getFocusables = (): HTMLElement[] =>
      Array.from(asideEl.querySelectorAll<HTMLElement>("button, a[href]"));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        collapse();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusables();
      const activeIndex = focusables.indexOf(document.activeElement as HTMLElement);
      const target = getTrapFocusTarget(focusables, activeIndex, event.shiftKey);

      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModal, collapse]);

  const isActive = pathname?.startsWith("/app/analyses") ?? false;

  return (
    <>
      <aside
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-sidebar/95 backdrop-blur transition-[width] duration-200 motion-reduce:transition-none",
          isModal ? "w-[min(256px,100vw-48px)] lg:w-64" : "w-16 lg:w-64",
        )}
        {...(isModal
          ? { role: "dialog" as const, "aria-modal": "true" as const, "aria-label": "Navigation" }
          : {})}
      >
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-sidebar-accent text-accent">
            <FilmIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="hidden lg:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              My
            </p>
            <h1 className="font-heading text-base font-semibold tracking-[-0.04em]">
              Content
            </h1>
          </div>
        </div>

        {isBelowLg && (
          <div className="flex justify-center border-b p-2 lg:hidden">
            <SidebarRailToggle isExpanded={isExpanded} toggleRef={toggleRef} onToggle={handleToggle} />
          </div>
        )}

        <nav id={SIDEBAR_NAV_ID} aria-label="Main" className="flex flex-1 flex-col gap-2 p-3">
          <p className="hidden text-xs font-medium uppercase tracking-wider text-muted-foreground lg:block">
            Analysis
          </p>
          <SidebarNavLink
            href="/app/analyses"
            label="Analyses"
            icon={BarChart3Icon}
            isActive={isActive}
          />
        </nav>
      </aside>

      {isModal && <SidebarScrim onDismiss={collapse} />}

      <main
        className="pl-16 lg:pl-64 min-h-dvh"
        inert={isModal || undefined}
        aria-hidden={isModal || undefined}
      >
        {children}
      </main>
    </>
  );
}
