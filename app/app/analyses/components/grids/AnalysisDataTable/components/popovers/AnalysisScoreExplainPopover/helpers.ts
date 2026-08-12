import { formatAbbrev } from "@/app/app/analyses/components/counts/EngagementCount/helpers";
import type { PerformanceComputed, ReachKind } from "@/lib/api/analyses/types";

/** R-13.3.4 — every numeral here is a stored operand or a stored result, never a worked
 * intermediate. `toFixed`/`toLocaleString` are display formatting, not derivation. */

/** DESIGN-3B §4.5's own worked example is `12 Jul 2026` — day-month-year, `en-GB` order. */
export function formatMeasuredDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "an unknown date";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function reachWord(reachKind: ReachKind): string {
  return reachKind === "PLAYS" ? "plays" : "views";
}

/** DESIGN-3B §3.1 — `4.1% of the people who saw it engaged.` (reach) / the follower-denominated
 * equivalent, `≈` prefixed per §4.5's staleness rule. `null` when Tier 1 never resolved. */
export function formatMeasuredEngagementLine(tier1: PerformanceComputed["tier1"]): string | null {
  if (tier1 == null) return null;
  const pct = (tier1.ratio * 100).toFixed(1);
  if (tier1.denominator === "REACH") {
    return `${pct}% of the people who saw it engaged.`;
  }
  return `≈${pct}% of followers engaged.`;
}

/** DESIGN-3B §3.1 — `It reached 3.2× this creator's usual for reels.` `null` at cold start
 * (no multiplier yet) — the popover does not fabricate a reading that isn't measured. */
export function formatMeasuredMultiplierLine(
  multiplier: number | null,
  bucketNoun: string | null,
): string | null {
  if (multiplier == null || bucketNoun == null) return null;
  return `It reached ${multiplier.toFixed(1)}× this creator's usual for ${bucketNoun}.`;
}

export type OperandRow = { label: string; value: string };

/** DESIGN-3B §4.4's operand list, laid out as label/value pairs — no worked division, the
 * em-rule between "Measured against" and "Engagement" is the only thing implying the operation.
 * `bucketNoun` (already resolved by `deriveMultiplierCell`, TDD §9.1) supplies the format
 * noun for the baseline row so "median of 7" never appears un-nouned (R-C1's sibling rule). */
export function buildOperandRows(computed: PerformanceComputed, bucketNoun: string | null): OperandRow[] {
  const rows: OperandRow[] = [];
  const { tier1, tier2, likes, comments, reach, audience } = computed;

  if (likes.value != null && (likes.state === "AVAILABLE" || likes.state === "ZERO")) {
    rows.push({ label: "Likes", value: likes.value.toLocaleString() });
  }
  if (comments.value != null && (comments.state === "AVAILABLE" || comments.state === "ZERO")) {
    rows.push({ label: "Comments", value: comments.value.toLocaleString() });
  }

  if (tier1 != null) {
    if (tier1.denominator === "REACH" && reach.value != null) {
      rows.push({ label: "Measured against", value: `${reach.value.toLocaleString()} ${reachWord(tier1.reachKind)}` });
    } else if (tier1.denominator === "FOLLOWERS" && audience.value != null) {
      rows.push({ label: "Measured against", value: `≈${audience.value.toLocaleString()} followers` });
    }
    const pct = `${(tier1.ratio * 100).toFixed(1)}%`;
    rows.push({
      label: "Engagement",
      value: tier1.denominator === "REACH" ? `${pct} of ${reachWord(tier1.reachKind)}` : `${pct} of followers`,
    });
  }

  if (tier2 != null && tier2.median != null && bucketNoun != null) {
    rows.push({
      label: "This creator's usual",
      value: `${formatAbbrev(tier2.median)} · median of ${tier2.sampleSize} ${bucketNoun}`,
    });
  }
  if (tier2?.multiplier != null) {
    rows.push({ label: "This post", value: `${tier2.multiplier.toFixed(1)}× their usual` });
  }

  return rows;
}
