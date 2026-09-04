import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/Sidebar";
import { installMatchMediaStub } from "@/tests/setup/matchMediaStub";

/**
 * Ticket #336 / TDD #284 §5, §7.2. Every assertion renders the real Sidebar
 * tree via `@testing-library/react` and drives the `lg` breakpoint through
 * the shared `matchMediaStub` — no source-text greps, `toContain`, or
 * independent existence-only checks.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/analyses",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} onClick={(event) => event.preventDefault()} {...props}>
      {children}
    </a>
  ),
}));

const LG_QUERY = "(max-width: 1023.98px)";

let stub: ReturnType<typeof installMatchMediaStub> | undefined;

afterEach(() => {
  stub?.restore();
  stub = undefined;
});

function renderSidebar() {
  return render(<Sidebar>content</Sidebar>);
}

function setBelowLg(matches: boolean) {
  act(() => {
    stub!.setMatches(LG_QUERY, matches);
  });
}

describe("Sidebar", () => {
  it("renders main byte-identical to today when the viewport is not below lg", () => {
    stub = installMatchMediaStub();
    renderSidebar();

    const main = screen.getByRole("main");

    expect(main.getAttribute("class")).toBe("pl-16 lg:pl-64 min-h-dvh");
    expect(main.hasAttribute("inert")).toBe(false);
    expect(main.hasAttribute("aria-hidden")).toBe(false);
  });

  it("renders no toggle at lg and above", () => {
    stub = installMatchMediaStub();
    renderSidebar();

    expect(screen.queryAllByRole("button", { name: /navigation/i }).length).toBe(0);
  });

  it("defaults to COMPACT below lg: toggle collapsed, aside has no role, no scrim", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    const aside = document.querySelector("aside")!;

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(aside.getAttribute("role")).toBe(null);
    expect(document.querySelectorAll('[aria-hidden="true"].fixed.inset-0').length).toBe(0);
  });

  it("the nav link label's visibility class flips COMPACT -> EXPANDED -> PERSISTENT, in that literal order", () => {
    stub = installMatchMediaStub();
    renderSidebar();

    const getLabelClass = () => screen.getByText("Analyses").getAttribute("class");

    setBelowLg(true);
    const compactClass = getLabelClass();

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));
    const expandedClass = getLabelClass();

    setBelowLg(false);
    const persistentClass = getLabelClass();

    expect([compactClass, expandedClass, persistentClass]).toEqual([
      "sr-only lg:not-sr-only",
      "not-sr-only",
      "sr-only lg:not-sr-only",
    ]);
  });

  it("expanding sets all six coupled dialog/toggle/main attributes in one paired assertion", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);

    const aside = document.querySelector("aside")!;
    const main = screen.getByRole("main", { hidden: true });

    expect([
      aside.getAttribute("role"),
      aside.getAttribute("aria-modal"),
      aside.getAttribute("aria-label"),
      toggle.getAttribute("aria-expanded"),
      toggle.getAttribute("aria-label"),
      main.hasAttribute("inert"),
    ]).toEqual(["dialog", "true", "Navigation", "true", "Collapse navigation", true]);
  });

  it("EXPANDED always overlays: main's class is byte-identical to COMPACT's, never pushed wider", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const compactMainClass = screen.getByRole("main").getAttribute("class");
    expect(compactMainClass).toBe("pl-16 lg:pl-64 min-h-dvh");

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));

    const expandedMainClass = screen.getByRole("main", { hidden: true }).getAttribute("class");
    expect(expandedMainClass).toBe(compactMainClass);
  });

  it("toggle's aria-controls resolves to the real nav landmark", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    const controlledId = toggle.getAttribute("aria-controls")!;

    expect(document.getElementById(controlledId)!.tagName).toBe("NAV");
  });

  it("rail contents are toggle then Analyses link, in that exact order", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const aside = document.querySelector("aside")!;
    const items = Array.from(aside.querySelectorAll<HTMLElement>("button, a[href]"));

    expect(items.map((el) => [el.tagName, el.getAttribute("aria-label")])).toEqual([
      ["BUTTON", "Expand navigation"],
      ["A", "Analyses"],
    ]);
  });

  it("tapping the nav link while EXPANDED does not collapse the drawer", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const link = screen.getByRole("link", { name: "Analyses" });
    fireEvent.click(link);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("collapsing via the toggle restores focus to the toggle", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("collapsing via the scrim restores focus to the toggle", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);

    const scrim = document.querySelector('[aria-hidden="true"].fixed.inset-0')!;
    fireEvent.click(scrim);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("collapsing via Esc restores focus to the toggle", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);

    // Real Escape presses originate at the focused element (the toggle,
    // per the fireEvent.click activation behaviour) and bubble up through
    // the aside -- dispatching on `document` would never reach a listener
    // scoped to the aside, per TDD #284 §5.4.
    fireEvent.keyDown(toggle, { key: "Escape" });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("traps Tab within the rail while EXPANDED: tabbing off the last focusable wraps to the toggle", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);

    const link = screen.getByRole("link", { name: "Analyses" });
    link.focus();
    expect(document.activeElement).toBe(link);

    fireEvent.keyDown(link, { key: "Tab" });

    expect(document.activeElement).toBe(toggle);
  });

  it("traps Shift+Tab within the rail while EXPANDED: shift-tabbing off the toggle wraps to the last focusable", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);
    toggle.focus();
    expect(document.activeElement).toBe(toggle);

    fireEvent.keyDown(toggle, { key: "Tab", shiftKey: true });

    const link = screen.getByRole("link", { name: "Analyses" });
    expect(document.activeElement).toBe(link);
  });

  it("Tab trap calls preventDefault when wrapping focus", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);
    toggle.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    act(() => {
      toggle.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
  });

  it("still traps focus when the active element is not a tracked focusable (activeIndex -1)", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);

    const aside = document.querySelector("aside")!;
    // Focus something inside the aside that is not one of the tracked
    // `button, a[href]` focusables (the aside container itself), so
    // `activeIndex` is -1 -- this must still be force-wrapped into the
    // trap rather than allowed to escape.
    aside.tabIndex = -1;
    aside.focus();
    expect(document.activeElement).toBe(aside);

    fireEvent.keyDown(aside, { key: "Tab" });

    expect(document.activeElement).toBe(toggle);
  });

  it("the Tab-trap/Esc listener is attached to the aside, not a permanent global document listener", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const aside = document.querySelector("aside")!;
    const asideAddSpy = vi.spyOn(aside, "addEventListener");
    const asideRemoveSpy = vi.spyOn(aside, "removeEventListener");
    const documentAddSpy = vi.spyOn(document, "addEventListener");
    const documentRemoveSpy = vi.spyOn(document, "removeEventListener");

    const netKeydownListeners = (addSpy: typeof asideAddSpy, removeSpy: typeof asideRemoveSpy) =>
      addSpy.mock.calls.filter((call) => call[0] === "keydown").length -
      removeSpy.mock.calls.filter((call) => call[0] === "keydown").length;

    const toggle = screen.getByRole("button", { name: /navigation/i });
    fireEvent.click(toggle);

    expect(netKeydownListeners(asideAddSpy, asideRemoveSpy)).toBe(1);
    expect(netKeydownListeners(documentAddSpy, documentRemoveSpy)).toBe(0);

    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(netKeydownListeners(asideAddSpy, asideRemoveSpy)).toBe(0);

    // Listener is gone; a second Escape must be a no-op, not throw, not
    // flip state.
    expect(() => fireEvent.keyDown(toggle, { key: "Escape" })).not.toThrow();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    asideAddSpy.mockRestore();
    asideRemoveSpy.mockRestore();
    documentAddSpy.mockRestore();
    documentRemoveSpy.mockRestore();
  });

  it("inert cannot leak to desktop after expanding below lg and then resizing up", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));
    expect(screen.getByRole("main", { hidden: true }).hasAttribute("inert")).toBe(true);

    setBelowLg(false);

    const main = screen.getByRole("main");
    const aside = document.querySelector("aside")!;

    expect(main.hasAttribute("inert")).toBe(false);
    expect(aside.getAttribute("role")).toBe(null);
    expect(screen.queryAllByRole("button", { name: /navigation/i }).length).toBe(0);
  });

  it("the design-mandated reset survives a round trip: expand below lg, cross above lg, cross back below lg lands COMPACT (not stale EXPANDED)", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));
    expect(screen.getByRole("main", { hidden: true }).hasAttribute("inert")).toBe(true);

    setBelowLg(false);
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });
    const aside = document.querySelector("aside")!;
    const main = screen.getByRole("main");

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(aside.getAttribute("role")).toBe(null);
    expect(main.hasAttribute("inert")).toBe(false);
    expect(document.querySelectorAll('[aria-hidden="true"].fixed.inset-0').length).toBe(0);
  });

  it("main's aria-hidden is pinned to the modal state, both directions", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    expect(screen.getByRole("main").getAttribute("aria-hidden")).toBe(null);

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));

    expect(screen.getByRole("main", { hidden: true }).getAttribute("aria-hidden")).toBe("true");
  });

  it("the aside's class is the literal pinned string in COMPACT/PERSISTENT and in EXPANDED", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const aside = document.querySelector("aside")!;
    const base =
      "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-sidebar/95 backdrop-blur transition-[width] duration-200 motion-reduce:transition-none";

    expect(aside.getAttribute("class")).toBe(`${base} w-16 lg:w-64`);

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));

    expect(aside.getAttribute("class")).toBe(`${base} w-[min(256px,100vw-48px)] lg:w-64`);
  });

  it("the toggle's class is the literal pinned string with a >=44x44px tap target", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    const toggle = screen.getByRole("button", { name: /navigation/i });

    expect(toggle.getAttribute("class")).toBe(
      "lg:hidden flex size-11 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
    );
  });

  it("the active nav link and its icon carry the literal lg: desktop-parity guard classes (row height, no accent bar, no icon fill, accent colour always)", () => {
    stub = installMatchMediaStub();
    renderSidebar();

    const link = screen.getByRole("link", { name: "Analyses" });

    expect(link.getAttribute("class")).toBe(
      "relative flex min-h-11 lg:min-h-0 items-center gap-3 rounded-lg border-l-[3px] lg:border-l-0 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent border-accent bg-sidebar-accent text-sidebar-foreground",
    );

    const icon = link.querySelector("svg")!;

    expect(icon.getAttribute("class")).toBe(
      "lucide lucide-chart-column size-4 shrink-0 lg:text-accent lg:fill-none text-accent fill-current",
    );
  });

  it("the scrim's class is the literal pinned string, including the reduced-motion opt-out", () => {
    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));

    const scrim = document.querySelector('[aria-hidden="true"].fixed.inset-0')!;

    expect(scrim.getAttribute("class")).toBe(
      "fixed inset-0 z-30 bg-black/60 lg:hidden transition-opacity duration-200 motion-reduce:transition-none",
    );
  });

  it("persists nothing: no storage writes while expanded, and remounting below lg is always COMPACT", () => {
    stub = installMatchMediaStub();
    const { unmount } = renderSidebar();
    setBelowLg(true);

    fireEvent.click(screen.getByRole("button", { name: /navigation/i }));

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    unmount();
    stub.restore();

    stub = installMatchMediaStub();
    renderSidebar();
    setBelowLg(true);

    expect(screen.getByRole("button", { name: /navigation/i }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

});
