import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisContentCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell";
import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";
import { AnalysisScoreCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

/**
 * Ticket #218 (3C-S4) — DESIGN-3C §2.2.1 (R-D17, Option B) and L8 (`AUDIT-3C-table-fidelity.md`).
 * R-D17: the Content column's caption snippet clamps to at most two lines, ellipsised where it
 * clips, and the clamp is a CEILING not a FLOOR — a short caption is never padded out and never
 * gets an ellipsis it doesn't need. L8 (second half): when the fallback ladder has already
 * promoted `caption` into the title slot (`title` is null), the caption must not render a
 * second time as line 2.
 */

const LONG_CAPTION =
  "Resep nasi goreng kampung ala rumahan yang gurih dan mudah dibuat untuk sarapan " +
  "keluarga besar, cocok juga dijual di warung kecil dekat rumah dengan modal terjangkau " +
  "dan bahan-bahan yang mudah didapat di pasar tradisional setiap pagi.";

const SHORT_CAPTION = "Resep cepat.";

// `SHORT_CAPTION` contains a literal `.`, a regex metacharacter — escape it before it is used to
// build a `RegExp` so occurrence-counting stays exact if the constant ever changes.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Minimal, fully-typed fixture for props the scope-guard test never reads (the guard only
// checks that the tier-phrase/qualifier text isn't clamped) — no `as` cast, so a future
// change to `AnalysisListItemIndexed` that this test should actually care about still
// surfaces as a `tsc` error here instead of being silently defeated.
function minimalIndexedRow(id: string): AnalysisListItemIndexed {
  return {
    id,
    prompt: null,
    status: "completed",
    url: "",
    platform: "instagram",
    mediaType: "reel",
    username: "row-under-test",
    overallScore: null,
    scorecard: null,
    schemaVersion: null,
    thumbnailUrl: null,
    viewCount: null,
    playCount: null,
    likeCount: null,
    likeAndViewCountsDisabled: null,
    postDate: null,
    durationSec: null,
    caption: null,
    title: null,
    createdAt: new Date().toISOString(),
    performance: null,
    style: null,
    searchText: "",
    viewCountState: { kind: "unknown" },
    likeCountState: { kind: "unknown" },
    tableDerived: null,
  };
}

function baseProps() {
  return {
    title: "Nasi Goreng Kampung" as string | null,
    caption: null as string | null,
    thumbnailUrl: null,
    mediaType: "reel" as const,
    analysisMode: null,
    comfortable: true,
    failedLabel: null as string | null,
  };
}

describe("AnalysisContentCell — caption clamp (R-D17 / §2.2.1)", () => {
  it("clamps a long caption to two lines with the CSS clamp class, while the full text stays in the DOM", () => {
    render(<AnalysisContentCell {...baseProps()} caption={LONG_CAPTION} />);

    const captionEl = screen.getByText(LONG_CAPTION);
    expect(captionEl.className).toContain("line-clamp-2");
    // The full string is queryable — no JS substring, nothing removed from the a11y tree.
    expect(captionEl.textContent).toBe(LONG_CAPTION);
  });

  it("does not pad a short caption to a two-line box — no fixed/min height is applied, on the caption or its wrapper", () => {
    render(<AnalysisContentCell {...baseProps()} caption={SHORT_CAPTION} />);

    const captionEl = screen.getByText(SHORT_CAPTION);
    const wrapperEl = captionEl.parentElement;
    // The clamp is a ceiling, never a floor: no height-forcing utility class is applied to the
    // caption OR its `min-w-0` wrapper. `FLOOR_HEIGHT_CLASS` matches ANY Tailwind height utility
    // token — `h-8` / `h-10` / `h-12` (the fixed scale), `h-[32px]` (arbitrary), and `min-h-8` /
    // `min-h-[32px]` (both forms of the min-height variant, since the `-h-` inside `min-h-`
    // still gets its own `\b` boundary after the hyphen) — not just the two literal strings a
    // narrower regex would hard-code. It does NOT catch a floor imposed some other way: an
    // inline `style` (checked separately below), a CSS Module class, an `aspect-*` ratio trick,
    // or a fixed height placed on an ancestor further up the row/grid than this wrapper.
    const FLOOR_HEIGHT_CLASS = /\bh-\S/;
    expect(captionEl.className).not.toMatch(FLOOR_HEIGHT_CLASS);
    expect(wrapperEl).not.toBeNull();
    expect(wrapperEl?.className).not.toMatch(FLOOR_HEIGHT_CLASS);
    expect(captionEl).not.toHaveAttribute("style");
    expect(wrapperEl).not.toHaveAttribute("style");
    expect(captionEl.textContent).toBe(SHORT_CAPTION);
  });

  it("renders the caption exactly once when title is null (L8) — the fallback ladder already promoted it to line 1", () => {
    const { container } = render(
      <AnalysisContentCell {...baseProps()} title={null} caption={SHORT_CAPTION} />,
    );

    const occurrences = (
      container.textContent?.match(new RegExp(escapeRegExp(SHORT_CAPTION), "g")) ?? []
    ).length;
    expect(occurrences).toBe(1);
  });

  it("renders the caption once when title is present (no regression on the normal two-line case)", () => {
    const { container } = render(
      <AnalysisContentCell {...baseProps()} title="Nasi Goreng Kampung" caption={SHORT_CAPTION} />,
    );

    const occurrences = (
      container.textContent?.match(new RegExp(escapeRegExp(SHORT_CAPTION), "g")) ?? []
    ).length;
    expect(occurrences).toBe(1);
    expect(screen.getByText("Nasi Goreng Kampung")).toBeInTheDocument();
  });

  it("does not render a caption line at all when there is no caption, title-null case falls back to Untitled", () => {
    render(<AnalysisContentCell {...baseProps()} title={null} caption={null} />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("drops the caption in Compact density (§3.2), unrelated to the R-D17 clamp", () => {
    render(<AnalysisContentCell {...baseProps()} caption={SHORT_CAPTION} comfortable={false} />);
    expect(screen.queryByText(SHORT_CAPTION)).not.toBeInTheDocument();
  });
});

describe("R-D17 scope guard — the clamp binds the caption and nothing else", () => {
  it("does not clamp the Performance cell's tier phrase (a qualifier, §3.1)", () => {
    const row = minimalIndexedRow("row-under-test");
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="3.2× based on 7 reels"
        confidenceWord="HIGH"
        isTier3={false}
        row={row}
      />,
    );

    // The text itself sits on an `aria-hidden` inline `<span>` with no className — walk up to
    // the `<p>` that actually carries the styling (and would carry a clamp class if one were
    // ever added), the same element a real regression would land on.
    const tierPhraseEl = screen.getByText("3.2× based on 7 reels").closest("p");
    expect(tierPhraseEl).not.toBeNull();
    // Pin the haystack: `not.toContain("line-clamp")` alone passes vacuously if `className`
    // were ever empty, so also assert the class list is non-empty and holds a class we expect.
    expect(tierPhraseEl?.className).not.toContain("line-clamp");
    // Ticket #222 (M8) moved the Performance cell's second line off `text-xs` (12px) onto
    // the mockup's 11px qualifier scale — see `AnalysisScoreCell.tsx`.
    expect(tierPhraseEl?.className).toContain("text-[11px]");
  });

  it("does not clamp an engagement column's denominator qualifier", () => {
    render(
      <AnalysisEngagementCell
        cell={{ kind: "reason", text: "measured against reach instead" }}
        denominator="FOLLOWERS"
      />,
    );

    const qualifierEl = screen.getByText("measured against reach instead");
    expect(qualifierEl.className).not.toContain("line-clamp");
    expect(qualifierEl.className).toContain("text-xs");
  });
});
