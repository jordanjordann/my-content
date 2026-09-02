import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnalysisProgressPanel } from "@/app/app/analyses/components/progress/AnalysisProgressPanel";
import type { ProgressState } from "@/app/app/analyses/components/progress/AnalysisProgressPanel/types";

/**
 * Ticket #320 (TDD §4.3) — renders per-URL failure reasons in the progress panel. Mounts the
 * REAL `AnalysisProgressPanel` with a mocked `ProgressState.failures` — nothing under test is
 * mocked beyond the props.
 */
describe("AnalysisProgressPanel — failure list (#320)", () => {
  it("renders both URLs and both reasons for a partial-success outcome", () => {
    const progress: ProgressState = {
      step: "complete",
      current: 3,
      total: 5,
      message: "Analysis complete — 3 analyses created",
      failures: [
        { url: "https://www.instagram.com/reel/abc", reason: "Content not found." },
        { url: "https://www.youtube.com/shorts/def", reason: "Video is private." },
      ],
    };

    render(<AnalysisProgressPanel progress={progress} onDismiss={vi.fn()} />);

    expect(screen.getByText("www.instagram.com/reel/abc")).toBeInTheDocument();
    expect(screen.getByText("Content not found.")).toBeInTheDocument();
    expect(screen.getByText("www.youtube.com/shorts/def")).toBeInTheDocument();
    expect(screen.getByText("Video is private.")).toBeInTheDocument();
  });

  it("renders the failure list for the all-failed (step: error) case too", () => {
    const progress: ProgressState = {
      step: "error",
      current: 0,
      total: 1,
      message: "No analyses were created",
      failures: [
        {
          url: "https://youtube.com/shorts/zzzZZZzzz12",
          reason: "Content not found — it may be deleted or the URL is wrong.",
        },
      ],
    };

    render(<AnalysisProgressPanel progress={progress} onDismiss={vi.fn()} />);

    expect(screen.getByText("0/1 URLs processed")).toBeInTheDocument();
    expect(screen.getByText("youtube.com/shorts/zzzZZZzzz12")).toBeInTheDocument();
    expect(
      screen.getByText("Content not found — it may be deleted or the URL is wrong."),
    ).toBeInTheDocument();
  });

  it("happy path (0 failures) — no empty list, no stray separator, live region still mounted", () => {
    const progress: ProgressState = {
      step: "complete",
      current: 2,
      total: 2,
      message: "Analysis complete — 2 analyses created",
      failures: [],
    };

    const { container } = render(<AnalysisProgressPanel progress={progress} onDismiss={vi.fn()} />);

    expect(container.querySelector("ul")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("the aria-live wrapper is in the DOM even when `failures` is undefined", () => {
    const progress: ProgressState = {
      step: "classifying",
      current: 0,
      total: 1,
      message: "Starting analysis...",
    };

    const { container } = render(<AnalysisProgressPanel progress={progress} onDismiss={vi.fn()} />);

    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});
