import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { EngagementCount } from "@/app/app/analyses/components/counts/EngagementCount";
import { MAX_SCORE } from "@/app/app/analyses/constants";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
import type { AnalysisTableDensity } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";
import {
  BASELINE_MIN_SAMPLE_DISPLAY,
  ROW_HEIGHT_PX,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import {
  formatPostedAge,
  formatPostedDate,
  isNonCompletedRow,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import { formatAbbrev } from "@/app/app/analyses/components/counts/EngagementCount/helpers";

type AnalysisTableRowProps = {
  row: AnalysisListItemIndexed;
  density: AnalysisTableDensity;
  onOpen: (id: string) => void;
  rowRef?: (el: HTMLTableRowElement | null) => void;
};

/**
 * One data row (design §3.1-§3.3). Renders every one of the 9 columns. Where a column's
 * real presentation belongs to a later ticket (#146 Counts/engagement componentry, #149
 * Content/Creator layout), this renders the same underlying data through the simplest
 * honest treatment available today rather than inventing new UI — marked inline.
 *
 * Per-cell state-matching/tier-phrase/bucket-noun *decisions* are precomputed once per row in
 * `lib/api/analyses/hooks.ts`'s `select` (`row.tableDerived`, PR #198 review blocker 8) —
 * this component only formats them into display strings, never re-derives them.
 *
 * Failed/non-completed treatment (OR-4, design §3.3): 3px rose left edge, every metric
 * cell `—`, Performance cell `Not analysed` (never an absent-score reason — a failed
 * analysis has no verdict to explain). `{reason}` in `Analysis failed — {reason}` is
 * omitted here: `AnalysisListItem` carries no failure-reason field today, and rendering a
 * fabricated reason would be a confident-looking wrong answer — flagged in the PR body.
 * `Queued` similarly omits the spec'd `· position {N}` — no queue-position field exists on
 * this row shape today — also flagged in the PR body rather than guessed.
 */
export function AnalysisTableRow({ row, density, onOpen, rowRef }: AnalysisTableRowProps) {
  const failed = isNonCompletedRow(row);
  const comfortable = density === "comfortable";

  // A click anywhere in the row opens it — real clicks land on a `<td>`'s content, never on
  // the bare `<tr>` itself, so `target !== currentTarget` (a check only a synthetic click
  // fired directly on the row can satisfy) is not a usable guard. The two named exceptions
  // (the explain affordance, #147's scope; the creator link, #149's scope) opt themselves out
  // by carrying `data-row-exempt` once they exist — this row does not special-case them by
  // name, so a descendant added later only needs the one attribute to keep working.
  const isExemptTarget = (target: EventTarget | null): boolean => {
    return target instanceof Element && target.closest("[data-row-exempt]") != null;
  };

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (isExemptTarget(event.target)) return;
    onOpen(row.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (isExemptTarget(event.target)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(row.id);
    }
  };

  return (
    <tr
      ref={rowRef}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ height: ROW_HEIGHT_PX[density] }}
      className={cn(
        "cursor-pointer border-b transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        failed && "border-l-[3px] border-l-rose-500",
      )}
    >
      {/* 1. Content — thumbnail/title layout is #149's scope; this renders title/caption
          text plus the OR-4 failed second line, which IS this ticket's scope. Line 2 is
          never truncated — the column widens instead if the text doesn't fit (ticket rule,
          PR #198 review blocker 7). */}
      <td className="p-3 align-middle">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded bg-muted" aria-hidden="true" />
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-medium", failed && "text-muted-foreground")}>
              {row.title || row.caption || "Untitled"}
            </p>
            {failed && (
              <p className="text-xs text-muted-foreground">
                {row.status === "failed" ? "Analysis failed" : "Queued"}
              </p>
            )}
            {!failed && comfortable && row.caption && (
              <p className="text-xs text-muted-foreground">{row.caption}</p>
            )}
          </div>
        </div>
      </td>

      {/* 2. Creator — full layout (platform glyph, link) is #149's scope. */}
      <td className="p-3 align-middle">
        <p className="truncate text-sm">@{row.username}</p>
        {comfortable && <p className="text-xs text-muted-foreground">{platformWord(row.platform)}</p>}
      </td>

      {/* 3. Posted — date + age + `Early` badge (provisional is already computed server-side). */}
      <td className="p-3 align-middle">
        {failed ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <>
            <p className="text-sm">{formatPostedDate(row.postDate) ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {formatPostedAge(row.postDate) ?? "—"}
              {row.performance?.computed.provisional && (
                <>
                  {" · "}
                  <span className="font-medium">Early</span>
                </>
              )}
            </p>
          </>
        )}
      </td>

      {/* 4. Counts — reach, sourced from `performance.computed.reach` (via `tableDerived`),
          never the raw `viewCountState` (#146 owns the full componentised Counts cell, incl.
          the three-case absent-count reason). Using the raw view count here could show a
          genuinely WRONG number under a wrong kind word for a carousel or plays-only reel —
          PR #198 review blocker 4 — so this renders the already-correct derived reach state,
          or an honest `—` when no performance block exists at all. */}
      <td className="p-3 align-middle">
        {failed || row.tableDerived == null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <>
            <EngagementCount state={row.tableDerived.reachCountState} metric="views" />
            {comfortable && (
              <p className="text-xs text-muted-foreground">
                <EngagementCount state={row.likeCountState} metric="likes" /> ·{" "}
                <span aria-hidden="true">—</span>
              </p>
            )}
          </>
        )}
      </td>

      {/* 5. Content score — numeral + pips, `Scores` group, never a second line. */}
      <td className="p-3 align-middle text-center">
        {failed ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <ScorePips score={row.overallScore} tone="content" />
        )}
      </td>

      {/* 6. Performance — numeral + pips, tier phrase / confidence, or the absent reason.
          Not analysed for failed rows (a distinct string from any absent-score reason,
          OR-4). Pip visuals/explain popover full behaviour are #147's scope. The confidence
          word renders unconditionally (DESIGN-3C §3.2's closed drop list for Compact density
          does not include it — PR #198 review blocker 6). */}
      <td className="p-3 align-middle">
        <PerformanceCell row={row} failed={failed} />
      </td>

      {/* 7. vs their usual — multiplier + sample size, or the bucket-scoped cold-start
          state (DESIGN-3C §5.3). */}
      <td className="p-3 align-middle">
        <MultiplierCell row={row} failed={failed} />
      </td>

      {/* 8/9. Eng. / reach, Eng. / followers — Direction A, two dedicated columns. */}
      <td className="p-3 align-middle">
        <EngagementRatioCell row={row} failed={failed} denominator="REACH" />
      </td>
      <td className="p-3 align-middle">
        <EngagementRatioCell row={row} failed={failed} denominator="FOLLOWERS" />
      </td>
    </tr>
  );
}

function platformWord(platform: AnalysisListItemIndexed["platform"]): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
}

/** DESIGN-3C §5 — five discrete square pips, `aria-hidden`, plus the accessible numeral text. */
function ScorePips({ score, tone }: { score: number | null; tone: "content" | "performance" }) {
  if (score == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="tabular-nums font-medium">{score}</span>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {Array.from({ length: MAX_SCORE }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-1.5 rounded-[1px]",
              index < score
                ? tone === "content"
                  ? "bg-muted-foreground"
                  : "bg-primary"
                : "bg-muted-foreground/30",
            )}
          />
        ))}
      </span>
      <span className="sr-only">{`${score} out of ${MAX_SCORE}`}</span>
    </span>
  );
}

function PerformanceCell({ row, failed }: { row: AnalysisListItemIndexed; failed: boolean }) {
  if (failed) {
    return <span className="text-sm text-muted-foreground">Not analysed</span>;
  }

  const cell = row.tableDerived?.performanceCell;

  if (cell == null || cell.kind === "reason") {
    const reasonText = cell?.text ?? "No performance data published";
    return <p className="text-xs text-muted-foreground">{reasonText}</p>;
  }

  return (
    <div>
      <ScorePips score={cell.score} tone="performance" />
      {cell.tierPhrase && (
        <p className={cn("text-xs text-muted-foreground", cell.isTier3 && "italic")}>
          {cell.tierPhrase}
        </p>
      )}
      {cell.confidenceWord && <p className="text-xs text-muted-foreground">{cell.confidenceWord}</p>}
    </div>
  );
}

function MultiplierCell({ row, failed }: { row: AnalysisListItemIndexed; failed: boolean }) {
  if (failed || row.tableDerived == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const content = row.tableDerived.multiplierCell;

  if (content.kind === "dash") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (content.kind === "reason") {
    return content.text != null ? (
      <p className="text-xs text-muted-foreground">{content.text}</p>
    ) : (
      <span className="text-sm text-muted-foreground">—</span>
    );
  }
  if (content.kind === "cold-start") {
    return (
      <div>
        <p className="text-xs text-muted-foreground">
          {content.sampleSize} of {BASELINE_MIN_SAMPLE_DISPLAY} {content.bucketNoun}
        </p>
        <p className="text-xs text-muted-foreground">builds as you analyse more</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm font-medium tabular-nums">{content.multiplier.toFixed(1)}×</p>
      <p className="text-xs text-muted-foreground">
        based on {content.sampleSize} {content.bucketNoun}
      </p>
    </div>
  );
}

function EngagementRatioCell({
  row,
  failed,
  denominator,
}: {
  row: AnalysisListItemIndexed;
  failed: boolean;
  denominator: "REACH" | "FOLLOWERS";
}) {
  if (failed || row.tableDerived == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const content =
    denominator === "REACH" ? row.tableDerived.engagementReachCell : row.tableDerived.engagementFollowersCell;

  if (content.kind === "dash") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (content.kind === "reason") {
    return <p className="text-xs text-muted-foreground">{content.text}</p>;
  }

  const valueLabel = `${(content.ratio * 100).toFixed(1)}%`;
  const qualifierLabel =
    content.denominator === "REACH"
      ? `of ${content.reachValue != null ? formatAbbrev(content.reachValue) : "—"} ${
          content.reachKind === "PLAYS" ? "plays" : "views"
        }`
      : `of ${content.followersValue != null ? formatAbbrev(content.followersValue) : "—"} followers`;
  const approx = content.denominator === "FOLLOWERS";

  return (
    <div>
      <p
        className={cn(
          "text-sm font-medium tabular-nums",
          denominator === "REACH" ? "text-accent" : "text-teal-500",
        )}
      >
        {approx ? `≈${valueLabel}` : valueLabel}
      </p>
      <p className="text-xs text-muted-foreground">{qualifierLabel}</p>
    </div>
  );
}
