import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SidebarNavLinkProps } from "@/components/Sidebar/types";

/**
 * A single rail nav link. Always renders icon + label; the label is visually
 * hidden (`sr-only`) only in COMPACT (below `lg`, not `isModal`) — hidden by
 * pure CSS `lg:not-sr-only` so it is correct even in the one frame before
 * hydration, since the real breakpoint state is unknown until then.
 * `isModal` additionally forces the label visible with `not-sr-only`: safe
 * to gate on JS state here because EXPANDED can only ever be reached via a
 * post-hydration user click on the toggle, so there is no flash risk. An
 * explicit `aria-label` keeps the accessible name stable in every state.
 * Active state relies on three redundant, non-colour-only cues: filled vs.
 * outline icon, accent colour, and a 3px accent left bar. Per design §3.1
 * these three cues (plus the taller `min-h-11` row) are scoped to the
 * compact rail only (below `lg`) via `lg:` variants — at `lg` and above the
 * row must render byte-identical to `main` pre-#284: 40px row height
 * (`lg:min-h-0`), no left accent bar (`lg:border-l-0`), no icon fill
 * (`lg:fill-none`), and the icon always `text-accent` regardless of active
 * state (`lg:text-accent`).
 */
export function SidebarNavLink({ href, label, icon: Icon, isActive, isModal }: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 lg:min-h-0 items-center gap-3 rounded-lg border-l-[3px] lg:border-l-0 border-transparent px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent",
        isActive && "border-accent bg-sidebar-accent text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 lg:text-accent lg:fill-none",
          isActive ? "text-accent fill-current" : "text-muted-foreground fill-none",
        )}
        aria-hidden="true"
      />
      <span className={isModal ? "not-sr-only" : "sr-only lg:not-sr-only"}>{label}</span>
    </Link>
  );
}
