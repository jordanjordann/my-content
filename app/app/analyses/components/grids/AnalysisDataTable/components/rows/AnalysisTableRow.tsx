import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { AnalysisScoreCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell";
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
import { AnalysisCountsCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCountsCell";
import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";

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
          never the raw `viewCountState`. Using the raw view count here could show a genuinely
          WRONG number under a wrong kind word for a carousel or plays-only reel — PR #198
          review blocker 4 — so this renders the already-correct derived reach state, plus
          OR-11's three-case absent-count reason, or an honest `—` when no performance block
          exists at all. */}
      <td className="p-3 align-middle">
        {failed || row.tableDerived == null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <AnalysisCountsCell
            reachCountState={row.tableDerived.reachCountState}
            likeCountState={row.likeCountState}
            absentCountReason={row.tableDerived.absentCountReason}
            comfortable={comfortable}
          />
        )}
      </td>

      {/* 5. Content score — numeral + pips, `Scores` group, never a second line. */}
      <td className="p-3 align-middle text-center">
        {failed || row.overallScore == null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <AnalysisScoreCell variant="content" score={row.overallScore} />
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

      {/* 8/9. Eng. / reach, Eng. / followers — Direction A, two dedicated columns, never one
          (OR-3 / R-12.3.4). */}
      <td className="p-3 align-middle">
        {failed || row.tableDerived == null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <AnalysisEngagementCell cell={row.tableDerived.engagementReachCell} denominator="REACH" />
        )}
      </td>
      <td className="p-3 align-middle">
        {failed || row.tableDerived == null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <AnalysisEngagementCell cell={row.tableDerived.engagementFollowersCell} denominator="FOLLOWERS" />
        )}
      </td>
    </tr>
  );
}

function platformWord(platform: AnalysisListItemIndexed["platform"]): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
}

function PerformanceCell({ row, failed }: { row: AnalysisListItemIndexed; failed: boolean }) {
  if (failed) {
    return <span className="text-sm text-muted-foreground">Not analysed</span>;
  }

  const cell = row.tableDerived?.performanceCell;

  if (cell == null || cell.kind === "reason") {
    // `cell?.text` is `null` for two genuine states: `INSUFFICIENT_HISTORY` (no approved
    // copy exists for it, DESIGN-3B §5.2 — `resolveUnavailableReasonCopy` returns `null`
    // on purpose) and `row.tableDerived == null` (a pre-schema-3 row). Neither state may
    // borrow another row's sentence (PR #198 review, round 3, blocker 2) — the same muted
    // "—" this table already uses for every other absent metric (`AnalysisScoreCell`,
    // `MultiplierCell`'s `dash` kind) is the honest placeholder here too.
    if (cell?.text != null) {
      return <p className="text-xs text-muted-foreground">{cell.text}</p>;
    }
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <AnalysisScoreCell
      variant="performance"
      score={cell.score}
      tierPhrase={cell.tierPhrase}
      isTier3={cell.isTier3}
      confidenceWord={cell.confidenceWord}
      row={row}
    />
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
