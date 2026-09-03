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

  it("toolbar buttons get >=44px touch height below lg only, via h-11 lg:h-8, desktop height unchanged", () => {
    const { container } = renderTable();
    const comfortable = container.querySelector('button[aria-pressed]');
    expect(comfortable).not.toBeNull();
    const cls = comfortable?.getAttribute("class") ?? "";
    expect(cls).toContain("h-11");
    expect(cls).toContain("lg:h-8");
  });
});
