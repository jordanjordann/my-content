import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { EngagementCount } from "@/app/app/analyses/components/counts/EngagementCount";
import { MAX_SCORE } from "@/app/app/analyses/constants";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
import type { AnalysisTableDensity } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";
import { ROW_HEIGHT_PX } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import {
  absentScoreReasonText,
  confidenceWord,
  engagementCellContent,
  formatPostedAge,
  formatPostedDate,
  isNonCompletedRow,
  multiplierCellContent,
  tierPhrase,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";

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
 * Failed/non-completed treatment (OR-4, design §3.3): 3px rose left edge, every metric
 * cell `—`, Performance cell `Not analysed` (never an absent-score reason — a failed
 * analysis has no verdict to explain). `{reason}` in `Analysis failed — {reason}` is
 * omitted here: `AnalysisListItem` carries no failure-reason field today, and rendering a
 * fabricated reason would be a confident-looking wrong answer — flagged in the PR body.
 */
export function AnalysisTableRow({ row, density, onOpen, rowRef }: AnalysisTableRowProps) {
  const failed = isNonCompletedRow(row);
  const comfortable = density === "comfortable";

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    onOpen(row.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
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
          text plus the OR-4 failed second line, which IS this ticket's scope. */}
      <td className="p-3 align-middle">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded bg-muted" aria-hidden="true" />
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-medium", failed && "text-muted-foreground")}>
              {row.title || row.caption || "Untitled"}
            </p>
            {failed && (
              <p className="truncate text-xs text-muted-foreground">
                {row.status === "failed" ? "Analysis failed" : "Queued"}
              </p>
            )}
            {!failed && comfortable && row.caption && (
              <p className="truncate text-xs text-muted-foreground">{row.caption}</p>
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

      {/* 4. Counts — the shipped four-state treatment reused for the reach line (#146 owns
          the full componentised Counts cell, incl. the three-case absent-count reason). */}
      <td className="p-3 align-middle">
        {failed ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <>
            <EngagementCount state={row.viewCountState} metric="views" />
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
          OR-4). Pip visuals/explain popover full behaviour are #147's scope. */}
      <td className="p-3 align-middle">
        <PerformanceCell row={row} failed={failed} comfortable={comfortable} />
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

function PerformanceCell({
  row,
  failed,
  comfortable,
}: {
  row: AnalysisListItemIndexed;
  failed: boolean;
  comfortable: boolean;
}) {
  if (failed) {
    return <span className="text-sm text-muted-foreground">Not analysed</span>;
  }

  const performance = row.performance;
  const score = performance?.judgement.performanceScore ?? null;

  if (score == null) {
    const reasonText = performance
      ? absentScoreReasonText(performance.computed)
      : "No performance data published";
    return <p className="text-xs text-muted-foreground">{reasonText}</p>;
  }

  const computed = performance!.computed;
  const phrase = tierPhrase(computed.tierUsed, computed.tier1?.denominator ?? null);
  const isTier3 = computed.tierUsed === "AUDIENCE_FALLBACK";
  const word = confidenceWord(computed.confidence);

  return (
    <div>
      <ScorePips score={score} tone="performance" />
      {phrase && (
        <p className={cn("text-xs text-muted-foreground", isTier3 && "italic")}>{phrase}</p>
      )}
      {comfortable && word && <p className="text-xs text-muted-foreground">{word}</p>}
    </div>
  );
}

function MultiplierCell({ row, failed }: { row: AnalysisListItemIndexed; failed: boolean }) {
  if (failed) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const content = multiplierCellContent(row.performance, failed);

  if (content.kind === "dash") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (content.kind === "reason") {
    return <p className="text-xs text-muted-foreground">{content.text}</p>;
  }
  if (content.kind === "cold-start") {
    return (
      <div>
        <p className="text-xs text-muted-foreground">{content.progressLabel}</p>
        <p className="text-xs text-muted-foreground">{content.reassuranceLabel}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm font-medium tabular-nums">{content.multiplierLabel}</p>
      <p className="text-xs text-muted-foreground">{content.sampleLabel}</p>
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
  if (failed) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const content = engagementCellContent(row.performance, failed, denominator);

  if (content.kind === "dash") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (content.kind === "reason") {
    return <p className="text-xs text-muted-foreground">{content.text}</p>;
  }
  return (
    <div>
      <p
        className={cn(
          "text-sm font-medium tabular-nums",
          denominator === "REACH" ? "text-accent" : "text-teal-500",
        )}
      >
        {content.approx ? `≈${content.valueLabel}` : content.valueLabel}
      </p>
      <p className="text-xs text-muted-foreground">{content.qualifierLabel}</p>
    </div>
  );
}
