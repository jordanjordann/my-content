import { formatAbbrev } from "@/app/app/analyses/components/counts/EngagementCount/helpers";
import type { AnalysisTableEngagementCell, ReachKind } from "@/lib/api/analyses/types";

type ValueCell = Extract<AnalysisTableEngagementCell, { kind: "value" }>;

/** Exhaustiveness helper, mirroring the server-side `assertNever` convention. */
function assertNever(value: never): never {
  throw new Error(`assertNever: unreachable ReachKind ${JSON.stringify(value)}`);
}

/**
 * AC-16 / PR #200 review, blocker B2 — the exhaustive form. `ReachKind` is a THREE-member
 * union (`"PLAYS" | "VIEWS" | "UNKNOWN"`); a binary ternary silently rendered "views" for
 * `UNKNOWN`, which is a confident, specific, WRONG word. `UNKNOWN` must never reach this
 * function — `AnalysisEngagementCell` filters it to the honest `—` placeholder before calling
 * any of the label formatters below, exactly as it already does for `cell.kind === "dash"`.
 * This throws rather than guessing so a caller that skips that guard fails loudly, not quietly.
 */
function reachKindWord(kind: ReachKind): "views" | "plays" {
  switch (kind) {
    case "PLAYS":
      return "plays";
    case "VIEWS":
      return "views";
    case "UNKNOWN":
      throw new Error(
        "reachKindWord: UNKNOWN must be filtered to the absent state before formatting — never guessed as 'views'/'plays'.",
      );
    default:
      return assertNever(kind);
  }
}

/** `4.1%` — the visible value line, formatted to one decimal place. */
export function formatEngagementValueLabel(cell: ValueCell): string {
  const percent = `${(cell.ratio * 100).toFixed(1)}%`;
  // R-D3 / TDD §9.2 — the `≈` prefix is mandatory on every follower-denominated figure
  // (the follower count is a ≤7-day-TTL cache, R3): it is a truthful signal, not decoration.
  return cell.denominator === "FOLLOWERS" ? `≈${percent}` : percent;
}

/**
 * `of 482.1K views` / `of 88.2K views · first slide only` / `of 284K followers` — the visible
 * qualifier line. The reach kind word (R-4.3.1 / AC-16) always comes from the cell's own
 * `reachKind`, never hard-coded or guessed: a `PLAYS` figure reads `plays` and never `views`.
 */
export function formatEngagementQualifierLabel(cell: ValueCell): string {
  if (cell.denominator === "REACH") {
    const value = cell.reachValue != null ? formatAbbrev(cell.reachValue) : "—";
    const kindWord = reachKindWord(cell.reachKind);
    // R-D3 — a video-bearing carousel's reach is derived from the first slide only (D4); the
    // qualifier says so explicitly rather than reading as an unqualified per-post reach.
    return cell.firstSlideOnly ? `of ${value} ${kindWord} · first slide only` : `of ${value} ${kindWord}`;
  }
  const value = cell.followersValue != null ? formatAbbrev(cell.followersValue) : "—";
  return `of ${value} followers`;
}

/**
 * The single-phrase accessible name (AC-25 / AC-21's own requirement, extended to the
 * accessibility tree): "4.1 percent of 482,100 views", never two detached fragments a screen
 * reader would announce as separate, unrelated nodes. Spells out "percent" (not the `%`
 * glyph) and the full comma-formatted number (not the abbreviated `482.1K`) — abbreviation is
 * a visual-density concession, not something an accessible name should inherit.
 */
export function formatEngagementAccessiblePhrase(cell: ValueCell): string {
  const percentWords = `${(cell.ratio * 100).toFixed(1)} percent`;

  if (cell.denominator === "REACH") {
    const value = cell.reachValue != null ? cell.reachValue.toLocaleString() : "an unknown number of";
    const kindWord = reachKindWord(cell.reachKind);
    const suffix = cell.firstSlideOnly ? ", first slide only" : "";
    return `${percentWords} of ${value} ${kindWord}${suffix}`;
  }

  const value = cell.followersValue != null ? cell.followersValue.toLocaleString() : "an unknown number of";
  return `approximately ${percentWords} of ${value} followers`;
}
