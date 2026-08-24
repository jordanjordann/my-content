import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisDetail } from "@/lib/api/analyses/types";

/**
 * Ticket #294 review (PR #297) — the reviewer's blocking finding: none of the five original
 * unit tests exercise anything that can actually break. Dropping `storedAnalysisMode` from the
 * SELECT, the route, or the hook's `select`, or deleting `UntrustedAnalysisWarningSection` from
 * the modal entirely, failed no test. This mounts the REAL `AnalysisDetailModal` against a
 * mocked `fetch` returning a real `AnalysisDetail` shape (same technique as
 * `AnalysesContent.dom.test.tsx`) so the banner's presence/absence is driven by the whole
 * `storedAnalysisMode` -> `AnalysisDetail` -> `useAnalysisQuery`'s `select` ->
 * `isUntrustedYoutubeMetadataOnly` -> `AnalysisDetailModal` -> `UntrustedAnalysisWarningSection`
 * chain, not a hand-typed `data` prop.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { AnalysisDetailModal } = await import(
  "@/app/app/analyses/components/modals/AnalysisDetailModal"
);

function makeDetail(overrides: Partial<AnalysisDetail>): AnalysisDetail {
  return {
    id: "row-under-test",
    prompt: null,
    status: "completed",
    title: "A YouTube Short",
    url: "https://youtube.com/shorts/x",
    platform: "youtube",
    mediaType: "short",
    username: "creator-yt",
    thumbnailUrl: null,
    viewCount: 1_000,
    playCount: null,
    likeCount: 50,
    likeAndViewCountsDisabled: null,
    postDate: "2026-07-01T00:00:00.000Z",
    caption: "A caption.",
    durationSec: 30,
    results: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    performance: null,
    storedAnalysisMode: null,
    ...overrides,
  };
}

function renderModal(detail: AnalysisDetail) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(detail), { status: 200 })) as unknown as typeof fetch;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return render(<AnalysisDetailModal id={detail.id} onClose={vi.fn()} />, { wrapper: Wrapper });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnalysisDetailModal — untrusted-analysis banner (ticket #294)", () => {
  it("renders the banner, announced via role=alert, for a youtube row with stored metadata_only", async () => {
    renderModal(makeDetail({ platform: "youtube", storedAnalysisMode: "metadata_only" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Video could not be downloaded");
  });

  it("does not render the banner for a healthy youtube row (stored full_video)", async () => {
    renderModal(makeDetail({ platform: "youtube", storedAnalysisMode: "full_video" }));

    // Wait for the fetch to resolve and the title to render before asserting absence, so this
    // isn't a false negative from asserting before data ever loaded.
    await screen.findByText("A YouTube Short");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("does not render the banner for a healthy instagram row with stored metadata_only (out of #294's scope)", async () => {
    renderModal(
      makeDetail({ platform: "instagram", mediaType: "reel", storedAnalysisMode: "metadata_only" }),
    );

    await screen.findByText("A YouTube Short");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
