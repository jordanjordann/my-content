import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";

/**
 * Ticket #335 (TDD §6.1) — the toolbar row (`Columns` menu + `Density` label + segmented
 * control) wraps below `lg` instead of clipping. `flex-wrap` is literally asserted on the
 * toolbar's own class string, and the segmented control's own wrapper class string is
 * asserted UNCHANGED so a "fix" that breaks its `rounded-r-none`/`rounded-l-none` pairing by
 * making it wrap internally would fail this test.
 */

const EXPECTED_TOOLBAR_CLASS = "flex flex-wrap items-center justify-end gap-2 border-b p-2";
const EXPECTED_SEGMENTED_WRAPPER_CLASS = "inline-flex rounded-md border";

// `Button size="sm"` is `h-7`. `cn()` (`twMerge(clsx(...))`) drops that unprefixed `h-7` the
// instant an unprefixed `h-11` is also present (same-breakpoint conflict), but `lg:h-7` survives
// untouched because it's a different (responsive) utility group — so below `lg` the button is
// `h-11` (>=44px touch height) and at `lg`+ it resolves to `lg:h-7`, i.e. byte-identical to the
// unmodified `Button size="sm"` height (28px). `lg:h-8` (32px) would be a visible desktop
// regression — see PR #340 review F1.
const EXPECTED_COMFORTABLE_BUTTON_CLASS =
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 h-11 rounded-r-none lg:h-7";
const EXPECTED_COMPACT_BUTTON_CLASS =
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 h-11 rounded-l-none lg:h-7";

function renderTable() {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ analyses: [], accounts: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } }), {
      status: 200,
    })) as unknown as typeof fetch;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return render(
    <AnalysisDataTable
      onAnalysisClick={() => {}}
      onNewAnalysis={() => {}}
      onClearFilters={() => {}}
    />,
    { wrapper: Wrapper },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Toolbar wrap (ticket #335)", () => {
  it("the toolbar row's full class attribute is exactly the flex-wrap variant, literally", () => {
    const { container } = renderTable();
    const toolbar = container.querySelector(".border-b.p-2");
    expect(toolbar).not.toBeNull();
    expect(toolbar?.getAttribute("class")).toBe(EXPECTED_TOOLBAR_CLASS);
    expect(toolbar?.getAttribute("class")).toContain("flex-wrap");
  });

  it("the density segmented control's own wrapper class string is unchanged (still unwrappable, still paired)", () => {
    const { container } = renderTable();
    const segmented = container.querySelector(".inline-flex.rounded-md.border");
    expect(segmented).not.toBeNull();
    expect(segmented?.getAttribute("class")).toBe(EXPECTED_SEGMENTED_WRAPPER_CLASS);

    const comfortable = segmented?.querySelector("button:first-child");
    const compact = segmented?.querySelector("button:last-child");
    expect(comfortable?.getAttribute("class")).toContain("rounded-r-none");
    expect(compact?.getAttribute("class")).toContain("rounded-l-none");
  });

  it("toolbar buttons get >=44px touch height below lg only, via h-11 lg:h-7, desktop height unchanged (full class, literal)", () => {
    const { container } = renderTable();
    const buttons = container.querySelectorAll('button[aria-pressed]');
    expect(buttons).toHaveLength(2);
    const [comfortable, compact] = Array.from(buttons);
    expect(comfortable.getAttribute("class")).toBe(EXPECTED_COMFORTABLE_BUTTON_CLASS);
    expect(compact.getAttribute("class")).toBe(EXPECTED_COMPACT_BUTTON_CLASS);
  });
});
