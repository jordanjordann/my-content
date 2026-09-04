import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { AnalysisScoreCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell";
import { AnalysisContentCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell";
import { AnalysisCreatorCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCreatorCell";
import { AnalysisStyleCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisStyleCell";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
import { NOT_COMPARABLE_MULTIPLIER_CELL_COPY } from "@/lib/api/analyses/constants";
import type { AnalysisTableColumnDef, AnalysisTableDensity } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";
import {
  ROW_HEIGHT_PX,
  STICKY_CONTENT_BODY_CELL_CLASSNAME,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import {
  formatPostedAge,
  formatPostedDate,
  isNonCompletedRow,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import { AnalysisCountsCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCountsCell";
import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";
import { AnalysisScoreExplainPopover } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover";

type AnalysisTableRowProps = {
  row: AnalysisListItemIndexed;
  /** Ticket #149 — the resolved, visibility-filtered display column list (table order). */
  columns: AnalysisTableColumnDef[];
  density: AnalysisTableDensity;
  onOpen: (id: string) => void;
  rowRef?: (el: HTMLTableRowElement | null) => void;
};

/**
 * One data row (design §3.1-§3.3). Renders exactly the columns in `columns` (ticket #149 —
 * `AnalysisDataTable` resolves visibility; Style only appears when the caller toggled it on).
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
export function AnalysisTableRow({ row, columns, density, onOpen, rowRef }: AnalysisTableRowProps) {
  const failed = isNonCompletedRow(row);
  const comfortable = density === "comfortable";
  const failedLabel = failed ? (row.status === "failed" ? "Analysis failed" : "Queued") : null;

  // A click anywhere in the row opens it — real clicks land on a `<td>`'s content, never on
  // the bare `<tr>` itself, so `target !== currentTarget` (a check only a synthetic click
  // fired directly on the row can satisfy) is not a usable guard. Descendants that must NOT
  // open the row (e.g. #147's explain affordance) opt themselves out via `data-row-exempt`.
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
      {columns.map((column) => (
        <td
          key={column.id}
          data-column-id={column.id}
          className={cn("p-3 align-top", column.id === "content" && STICKY_CONTENT_BODY_CELL_CLASSNAME)}
        >
          {renderCell(column.id, row, { failed, failedLabel, comfortable })}
        </td>
      ))}
    </tr>
  );
}

function renderCell(
  columnId: string,
  row: AnalysisListItemIndexed,
  ctx: { failed: boolean; failedLabel: string | null; comfortable: boolean },
) {
  switch (columnId) {
    case "content":
      return (
        <AnalysisContentCell
          title={row.title}
          caption={row.caption}
          thumbnailUrl={row.thumbnailUrl}
          mediaType={row.mediaType}
          analysisMode={row.tableDerived?.analysisMode ?? null}
          comfortable={ctx.comfortable}
          failedLabel={ctx.failedLabel}
        />
      );

    case "creator":
      return <AnalysisCreatorCell username={row.username} platform={row.platform} comfortable={ctx.comfortable} />;

    case "posted":
      if (ctx.failed) return <span className="text-[12.5px] text-muted-foreground">—</span>;
      return (
        <>
          <p className="text-[12.5px]">{formatPostedDate(row.postDate) ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatPostedAge(row.postDate) ?? "—"}
            {row.performance?.computed.provisional && (
              <>
                {" · "}
                <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  Early
                </span>
              </>
            )}
          </p>
        </>
      );

    case "counts":
      if (ctx.failed || row.tableDerived == null) return <span className="text-[12.5px] text-muted-foreground">—</span>;
      return (
        <AnalysisCountsCell
          reachCountState={row.tableDerived.reachCountState}
          likeCountState={row.likeCountState}
          commentCountState={row.tableDerived.commentCountState}
          absentCountReason={row.tableDerived.absentCountReason}
          comfortable={ctx.comfortable}
        />
      );

    case "contentScore":
      if (ctx.failed || row.overallScore == null) return <span className="text-[12.5px] text-muted-foreground">—</span>;
      return <AnalysisScoreCell variant="content" score={row.overallScore} />;

    case "performance":
      return <PerformanceCell row={row} failed={ctx.failed} />;

    case "multiplier":
      return <MultiplierCell row={row} failed={ctx.failed} />;

    case "engagementReach":
      if (ctx.failed || row.tableDerived == null) return <span className="text-[12.5px] text-muted-foreground">—</span>;
      return <AnalysisEngagementCell cell={row.tableDerived.engagementReachCell} denominator="REACH" />;

    case "engagementFollowers":
      if (ctx.failed || row.tableDerived == null) return <span className="text-[12.5px] text-muted-foreground">—</span>;
      return <AnalysisEngagementCell cell={row.tableDerived.engagementFollowersCell} denominator="FOLLOWERS" />;

    case "style":
      if (ctx.failed) return <span className="text-[12.5px] text-muted-foreground">—</span>;
      return <AnalysisStyleCell style={row.style} />;

    default:
      return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }
}

function PerformanceCell({ row, failed }: { row: AnalysisListItemIndexed; failed: boolean }) {
  if (failed) {
    return <span className="text-[12.5px] text-muted-foreground">Not analysed</span>;
  }

  if (row.tableDerived == null) {
    // Row 9 (DESIGN-3B §5.5) — a completed analysis with no performance block at all. NOT
    // the failed treatment: nothing failed, so no rose edge and no "Not analysed" (that
    // string is row 7's). There is no computed block for a popover to show, so this row
    // carries no `ⓘ` — the affordance must never open onto an empty popover.
    return <p className="text-[11px] text-muted-foreground">Performance wasn&apos;t measured</p>;
  }

  const cell = row.tableDerived.performanceCell;

  if (cell.kind === "dash") {
    // `INSUFFICIENT_HISTORY` — declared on `UnavailableReason`, never produced (DESIGN-3B
    // §5.5). No approved copy exists for it; the muted "—" stays, on purpose.
    return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }

  if (cell.kind === "no-judgement") {
    // Row 8 (DESIGN-3B §5.5) — a performance block exists and the model declined to score
    // it. The row keeps its single `ⓘ`: a computed block exists, so the popover has real
    // content. `AnalysisScoreExplainPopover` is reused directly (not duplicated) because
    // `AnalysisScoreCell`'s "performance" variant — the popover's other call site — only
    // renders when a score exists, which row 8 does not have.
    return (
      <p className="text-[11px] text-muted-foreground">
        No 1–5 for this post <AnalysisScoreExplainPopover row={row} />
      </p>
    );
  }

  if (cell.kind === "reason") {
    return <p className="text-[11px] text-muted-foreground">{cell.text}</p>;
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
    return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }

  const content = row.tableDerived.multiplierCell;

  if (content.kind === "dash") {
    return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }
  if (content.kind === "reason") {
    return content.text != null ? (
      <p className="text-[11px] text-muted-foreground">{content.text}</p>
    ) : (
      <span className="text-[12.5px] text-muted-foreground">—</span>
    );
  }
  if (content.kind === "cold-start") {
    return (
      <div>
        <p className="text-[11px] text-muted-foreground">
          {content.sampleSize} of {content.minSample} {content.bucketNoun}
        </p>
        <p className="text-[11px] text-muted-foreground">builds as you analyse more</p>
      </div>
    );
  }
  if (content.kind === "not-comparable") {
    // Ticket #251 — a full baseline exists but this post's own metric never resolved
    // against it. Statement only: no button, link, or other interactive affordance
    // (OR-25, settled — no retry).
    return <p className="text-[11px] text-muted-foreground">{NOT_COMPARABLE_MULTIPLIER_CELL_COPY[content.reason]}</p>;
  }
  return (
    <div>
      <p className="text-[12.5px] font-medium tabular-nums">{content.multiplier.toFixed(1)}×</p>
      <p className="text-[11px] text-muted-foreground">
        based on {content.sampleSize} {content.bucketNoun}
      </p>
    </div>
  );
}
