import type {
  AnalysisListItemIndexed,
  AnalysisPerformance,
  Confidence,
  PerformanceComputed,
  Tier,
  UnavailableReason,
} from "@/lib/api/analyses/types";
import { BASELINE_MIN_SAMPLE_DISPLAY } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import { formatAbbrev } from "@/app/app/analyses/components/counts/EngagementCount/helpers";
import type { AnalysisTableRowGroups } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";

/** A row not in `"completed"` status gets the whole-row failed/non-completed treatment (OR-4). */
export function isNonCompletedRow(row: AnalysisListItemIndexed): boolean {
  return row.status !== "completed";
}

/**
 * Partitions one loaded page's rows into the three display groups (design §3.3, §6.1 —
 * R-S1/R-S2). This does NOT re-sort: R-S1 (absent values sink, in both directions) is
 * now server-enforced by ticket #144, so within each bucket the server's own order is
 * preserved untouched (stable partition only), per this ticket's explicit instruction
 * not to re-sort client-side in a way that could override the server's ordering.
 */
export function groupAnalysisRows(rows: AnalysisListItemIndexed[]): AnalysisTableRowGroups {
  const scored: AnalysisListItemIndexed[] = [];
  const scoreless: AnalysisListItemIndexed[] = [];
  const nonCompleted: AnalysisListItemIndexed[] = [];

  for (const row of rows) {
    if (isNonCompletedRow(row)) {
      nonCompleted.push(row);
      continue;
    }
    if (row.performance?.judgement.performanceScore != null) {
      scored.push(row);
    } else {
      scoreless.push(row);
    }
  }

  return { scored, scoreless, nonCompleted };
}

/**
 * Mirrors `lib/server/analysis/performance/judgement.ts`'s shipped
 * `renderUnavailableReasonShortForm` — copied verbatim (not re-derived) because that
 * module lives under `lib/server` and is not importable from a client component. The
 * strings below are the exact approved L1 copy (DESIGN-3B §5).
 *
 * `REACH_NOT_ON_FIRST_SLIDE` is a deliberate deviation from the server function: DESIGN-3C
 * §5.4's binding rule R-N1 requires the actual later-slide figure and its kind to render
 * alongside this state, or the state must not render at all. `AnalysisListItem`/
 * `PerformanceComputed` (ticket #144's shipped shape) carries no such figure, so this
 * table can never satisfy R-N1 for that reason value and always falls back to the
 * `CAUSE_NOT_DETERMINABLE` (row 3) copy instead, exactly as R-N1 prescribes.
 *
 * `INSUFFICIENT_HISTORY` is declared on the type but, per the server module's own
 * comment, intentionally never produced — unreachable in production. No approved copy
 * exists for it, so this also degrades to row 3's copy rather than fabricating a string.
 */
export function renderUnavailableReasonShortFormClient(
  reason: Exclude<UnavailableReason, "CAUSE_NOT_DETERMINABLE">,
): string {
  switch (reason) {
    case "REACH_HIDDEN":
      return "Creator hid the counts";
    case "REACH_UNKNOWN":
      return "No view count published";
    case "NO_AUDIENCE_DATA":
      return "No follower count available";
    case "CONTENT_KIND_UNSUPPORTED":
      return "This post type doesn't report view counts.";
    case "REACH_NOT_ON_FIRST_SLIDE":
    case "INSUFFICIENT_HISTORY":
      return "No performance data published";
    default:
      return "No performance data published";
  }
}

/**
 * DESIGN-3B §5.4 — `CAUSE_NOT_DETERMINABLE` is reached by two different routes (row 3 vs
 * row 3b) that must not share one sentence (R-13.5.3a). This is exactly the deciding
 * matrix the design specifies: "usable" means `AVAILABLE` or `ZERO`; `UNKNOWN`/`HIDDEN`
 * are not usable. Implemented here (not by passing the bare enum into a renderer that
 * cannot see these states) per the constraint the designer flagged for this ticket.
 */
function isUsableAvailability(state: PerformanceComputed["likes"]["state"]): boolean {
  return state === "AVAILABLE" || state === "ZERO";
}

export function renderCauseNotDeterminableCopy(computed: PerformanceComputed): string {
  const followerKnown = computed.audience.value != null;
  const likeUsable = isUsableAvailability(computed.likes.state);
  const commentUsable = isUsableAvailability(computed.comments.state);
  const exactlyOneUsable = likeUsable !== commentUsable;

  // Row 3b — engagement published in part (§5.4 table, row 2: follower count known AND
  // exactly one of like/comment usable).
  if (followerKnown && exactlyOneUsable) {
    return "Engagement data incomplete";
  }

  // Everything else that resolves to `CAUSE_NOT_DETERMINABLE` reads as row 3 — including
  // the "not known, exactly one usable" case, which the matrix routes to `NO_AUDIENCE_DATA`
  // (row 4) upstream, not here; if it somehow arrives here anyway, row 3's copy is still
  // the closer of the two available truths (nothing usable is the row 3 fact pattern).
  return "No performance data published";
}

/**
 * The single entry point cells use for an absent performance score (DESIGN-3B §5, DESIGN-3C
 * §5.4). Handles the row-3-vs-3b disambiguation by branching on `computed` rather than the
 * bare enum, per this ticket's explicit constraint.
 */
export function absentScoreReasonText(computed: PerformanceComputed): string {
  if (computed.unavailableReason == null) {
    return "No performance data published";
  }
  if (computed.unavailableReason === "CAUSE_NOT_DETERMINABLE") {
    return renderCauseNotDeterminableCopy(computed);
  }
  return renderUnavailableReasonShortFormClient(computed.unavailableReason);
}

/** TDD §9.3 / DESIGN-3B §3.1 (governing per Q4) — the tier phrase is never the raw enum. */
export function tierPhrase(
  tierUsed: Tier,
  denominator: "REACH" | "FOLLOWERS" | null,
): string | null {
  switch (tierUsed) {
    case "CREATOR_BASELINE":
      return "vs their usual";
    case "REACH_ONLY":
      return denominator === "FOLLOWERS" ? "vs follower count" : "of who saw it";
    case "AUDIENCE_FALLBACK":
      return "rough — vs audience size";
    case "UNAVAILABLE":
      return null;
    default:
      return null;
  }
}

/** DESIGN-3C §5.1 — the confidence word, Comfortable-only. */
export function confidenceWord(confidence: Confidence): string | null {
  switch (confidence) {
    case "HIGH":
      return "high confidence";
    case "MEDIUM":
      return "medium confidence";
    case "LOW":
      return "low confidence";
    case "NONE":
      return null;
    default:
      return null;
  }
}

/**
 * Mirrors `lib/server/analysis/performance/baseline.ts`'s shipped `bucketNoun` (OR-9) —
 * copied verbatim for the same "not importable from a client component" reason as
 * `renderUnavailableReasonShortFormClient` above. Renders `based on {N} {noun}` using the
 * user's own words for the format bucket, never the literal word "posts" for a bucket
 * that has one.
 */
export function bucketNoun(bucketKey: string): string {
  const [, mediaType, analysisMode] = bucketKey.split(":");

  if (mediaType === "reel") return "reels";
  if (mediaType === "carousel") return "carousels";
  if (mediaType === "short") return "Shorts";
  if (mediaType === "post" && analysisMode === "full_video") return "videos";
  return "posts";
}

export type MultiplierCellContent =
  | { kind: "measured"; multiplierLabel: string; sampleLabel: string }
  | { kind: "cold-start"; progressLabel: string; reassuranceLabel: string }
  | { kind: "reason"; text: string }
  | { kind: "dash" };

/**
 * The `vs their usual` cell (col 7, TDD §9.1 / DESIGN-3C §5.3). R-C1: the bare threshold
 * (`5 posts`) never appears un-nouned; R-C3: the count is the bucket's own count, never a
 * creator total — both satisfied because the noun and count come from `tier2` itself.
 */
export function multiplierCellContent(
  performance: AnalysisPerformance,
  isNonCompleted: boolean,
): MultiplierCellContent {
  if (isNonCompleted || performance == null) {
    return { kind: "dash" };
  }

  const { tier2, unavailableReason } = performance.computed;

  if (tier2 == null) {
    if (unavailableReason != null) {
      return { kind: "reason", text: absentScoreReasonText(performance.computed) };
    }
    return { kind: "dash" };
  }

  if (tier2.multiplier != null) {
    const noun = bucketNoun(tier2.bucketKey);
    return {
      kind: "measured",
      multiplierLabel: `${tier2.multiplier.toFixed(1)}×`,
      sampleLabel: `based on ${tier2.sampleSize} ${noun}`,
    };
  }

  // Cold start (§5.3, R-C4 — a partial absence, not an absent score; never sinks).
  const noun = bucketNoun(tier2.bucketKey);
  return {
    kind: "cold-start",
    progressLabel: `${tier2.sampleSize} of ${BASELINE_MIN_SAMPLE_DISPLAY} ${noun}`,
    reassuranceLabel: "builds as you analyse more",
  };
}

export type EngagementCellContent =
  | { kind: "value"; valueLabel: string; qualifierLabel: string; approx: boolean }
  | { kind: "reason"; text: string }
  | { kind: "dash" };

/**
 * Cols 8/9 — Direction A (TDD §9.2 / DESIGN-3C §4). Every row fills exactly one of the two
 * columns; the other renders a plain-language reason, never a blank. The `≈` prefix is
 * truthful, not decorative (follower counts are cached, up to a 7-day TTL — DESIGN-3C §4
 * point 2), so it is applied to follower-denominated figures only.
 *
 * The two symmetric "wrong-denominator" reasons (`no reach measure here` /
 * `no follower measure here`) mirror DESIGN-3C §4's own worked example, which states the
 * follower-side phrase verbatim (`no follower measure here`) and constructs the reach-side
 * phrase by the same grammatical pattern where no more specific `unavailableReason` copy
 * applies — flagged in this ticket's PR body as a fill for a gap in the design record
 * rather than an invented new concept.
 */
export function engagementCellContent(
  performance: AnalysisPerformance,
  isNonCompleted: boolean,
  denominator: "REACH" | "FOLLOWERS",
): EngagementCellContent {
  if (isNonCompleted || performance == null) {
    return { kind: "dash" };
  }

  const { tier1, unavailableReason, reach, audience } = performance.computed;

  if (tier1?.denominator === denominator) {
    if (tier1.denominator === "REACH") {
      const kindWord = tier1.reachKind === "PLAYS" ? "plays" : "views";
      return {
        kind: "value",
        valueLabel: `${(tier1.ratio * 100).toFixed(1)}%`,
        qualifierLabel: `of ${reach.value != null ? formatAbbrev(reach.value) : "—"} ${kindWord}`,
        approx: false,
      };
    }
    return {
      kind: "value",
      valueLabel: `${(tier1.ratio * 100).toFixed(1)}%`,
      qualifierLabel: `of ${audience.value != null ? formatAbbrev(audience.value) : "—"} followers`,
      approx: true,
    };
  }

  if (unavailableReason != null) {
    return { kind: "reason", text: absentScoreReasonText(performance.computed) };
  }

  if (tier1 != null) {
    // Tier 1 resolved, but against the OTHER denominator — this row genuinely has no
    // figure for this column, and no stored `unavailableReason` explains why (there is
    // nothing wrong; the other denominator simply won).
    return {
      kind: "reason",
      text: denominator === "REACH" ? "no reach measure here" : "no follower measure here",
    };
  }

  return { kind: "dash" };
}

/** Posted column (col 3) — `12 Jul` / `25d ago`. Age is derived from `postDate` only. */
export function formatPostedDate(postDate: string | null): string | null {
  if (!postDate) return null;
  const date = new Date(postDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function formatPostedAge(postDate: string | null): string | null {
  if (!postDate) return null;
  const date = new Date(postDate);
  if (Number.isNaN(date.getTime())) return null;
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  return `${days}d ago`;
}
