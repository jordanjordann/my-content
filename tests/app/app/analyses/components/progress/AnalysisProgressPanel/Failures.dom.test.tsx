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
  it("pins each URL to its own reason — not just 'both exist somewhere' (#320 acceptance criterion)", () => {
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

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe("www.instagram.com/reel/abc — Content not found.");
    expect(items[1].textContent).toBe("www.youtube.com/shorts/def — Video is private.");
  });

  it("lists every failure individually, uncapped, for a larger batch", () => {
    const failures = Array.from({ length: 5 }, (_, i) => ({
      url: `https://www.instagram.com/reel/item${i}`,
      reason: `Reason ${i}`,
    }));
    const progress: ProgressState = {
      step: "complete",
      current: 0,
      total: 5,
      message: "No analyses were created",
      failures,
    };

    render(<AnalysisProgressPanel progress={progress} onDismiss={vi.fn()} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    failures.forEach((f, i) => {
      expect(items[i].textContent).toBe(`www.instagram.com/reel/item${i} — Reason ${i}`);
    });
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
