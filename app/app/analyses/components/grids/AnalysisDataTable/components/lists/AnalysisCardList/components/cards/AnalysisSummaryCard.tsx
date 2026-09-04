import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AnalysisContentCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell";
import { AnalysisCreatorCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCreatorCell";
import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import {
  formatPostedAge,
  formatPostedDate,
  isNonCompletedRow,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import type { AnalysisSummaryCardProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/lists/AnalysisCardList/types";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

/**
 * Ticket #337 (TDD §6.3, C-6) / owner decision on issue #337 (2026-09-03) — the exact ordered
 * six card fields: the four `LOCKED_COLUMN_IDS` (content, performance, engagementReach,
 * engagementFollowers — never hideable, DESIGN-3C §6.3 / R-12.3.1), plus `creator` (upgraded
 * from optional to owner-required) and `posted`. Labels are read straight off
 * `ANALYSES_TABLE_COLUMNS` — the table's own label source — never retyped, so the card and the
 * table are guaranteed to say the exact same thing for the exact same column.
 */
type CardFieldId = "content" | "performance" | "engagementReach" | "engagementFollowers" | "creator" | "posted";

function columnLabel(id: CardFieldId): string {
  const column = ANALYSES_TABLE_COLUMNS.find((candidate) => candidate.id === id);
  if (!column) {
    throw new Error(`AnalysisSummaryCard: no ANALYSES_TABLE_COLUMNS entry for "${id}"`);
  }
  return column.label;
}

/**
 * One stacked card (<640px, design §8) — the phone equivalent of one `AnalysisTableRow`. A
 * real `<button>` (>=44px tall via `min-h-11`) so tap-to-open is native and keyboard-operable,
 * named by the post's own title/caption via `aria-label` (mirrors `AnalysisContentCell`'s own
 * title fallback ladder). `Enter` is handled explicitly (mirrors `AnalysisTableRow`'s own
 * `<tr>` handling) and calls `preventDefault` so a real browser's own native Enter-triggers-
 * click activation never fires `onOpen` a second time for the same keypress; `onClick` alone
 * covers mouse/touch and Space (native button activation).
 *
 * Field content (Performance, Posted) mirrors `AnalysisTableRow.tsx`'s private
 * `PerformanceCell`/inline `"posted"` branch's COPY exactly, using the same pure formatters
 * (`formatPostedDate`/`formatPostedAge`) — not `AnalysisTableRow.tsx` itself, which #337's own
 * file-affected list does not include (owned by ticket #335). No new copy is invented anywhere
 * in this file.
 *
 * Deliberate deviation for the "score" branch only: the table's `PerformanceCell` renders
 * `AnalysisScoreCell`, which embeds `AnalysisScoreExplainPopover` — a real, focusable
 * `<button>`. Nesting a `<button>` inside this card's own whole-card `<button>` is invalid
 * HTML (interactive content cannot contain interactive content) and would let a tap on the
 * inner popover trigger bubble into this card's own `onClick`, firing `onOpen` when the user
 * only meant to open the popover. The ticket's own field list only mandates reusing
 * `AnalysisContentCell` and `AnalysisEngagementCell` verbatim — for Performance it only
 * requires the same approved COPY, which this file reproduces (score, tier phrase,
 * confidence word, and every absent-value reason string), just without the inline explain
 * trigger. Full detail remains one tap away via the card's own primary action (opening the
 * detail modal).
 */
export function AnalysisSummaryCard({ row, onOpen }: AnalysisSummaryCardProps) {
  const failed = isNonCompletedRow(row);
  const failedLabel = failed ? (row.status === "failed" ? "Analysis failed" : "Queued") : null;
  const ariaLabel = row.title || row.caption || "Untitled";

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(row.id);
    }
  };

  return (
    <button
      type="button"
      data-testid="analysis-summary-card"
      aria-label={ariaLabel}
      onClick={() => onOpen(row.id)}
      onKeyDown={handleKeyDown}
      className="flex min-h-11 w-full flex-col gap-3 p-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <CardField label={columnLabel("content")}>
        <AnalysisContentCell
          title={row.title}
          caption={row.caption}
          thumbnailUrl={row.thumbnailUrl}
          mediaType={row.mediaType}
          analysisMode={row.tableDerived?.analysisMode ?? null}
          comfortable
          failedLabel={failedLabel}
        />
      </CardField>

      <CardField label={columnLabel("performance")}>
        <PerformanceValue row={row} failed={failed} />
      </CardField>

      <CardField label={columnLabel("engagementReach")}>
        {failed || row.tableDerived == null ? (
          <span className="text-[12.5px] text-muted-foreground">—</span>
        ) : (
          <AnalysisEngagementCell cell={row.tableDerived.engagementReachCell} denominator="REACH" />
        )}
      </CardField>

      <CardField label={columnLabel("engagementFollowers")}>
        {failed || row.tableDerived == null ? (
          <span className="text-[12.5px] text-muted-foreground">—</span>
        ) : (
          <AnalysisEngagementCell cell={row.tableDerived.engagementFollowersCell} denominator="FOLLOWERS" />
        )}
      </CardField>

      <CardField label={columnLabel("creator")}>
        <AnalysisCreatorCell username={row.username} platform={row.platform} comfortable />
      </CardField>

      <CardField label={columnLabel("posted")}>
        <PostedValue row={row} failed={failed} />
      </CardField>
    </button>
  );
}

/** One labelled key-value row (design §8 — "key fields as labeled key-value pairs"). */
function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p
        data-testid="analysis-card-field-label"
        className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/** Mirrors `AnalysisTableRow.tsx`'s private `PerformanceCell` branch-for-branch. */
function PerformanceValue({ row, failed }: { row: AnalysisListItemIndexed; failed: boolean }) {
  if (failed) {
    return <span className="text-[12.5px] text-muted-foreground">Not analysed</span>;
  }

  if (row.tableDerived == null) {
    return <p className="text-[11px] text-muted-foreground">Performance wasn&apos;t measured</p>;
  }

  const cell = row.tableDerived.performanceCell;

  if (cell.kind === "dash") {
    return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }

  if (cell.kind === "no-judgement") {
    // See this file's module doc — the interactive explain-popover trigger is intentionally
    // omitted here (nested-button hazard); the approved copy itself is unchanged.
    return <p className="text-[11px] text-muted-foreground">No 1–5 for this post</p>;
  }

  if (cell.kind === "reason") {
    return <p className="text-[11px] text-muted-foreground">{cell.text}</p>;
  }

  return (
    <div>
      <p className="text-[12.5px] font-semibold tabular-nums text-primary">{cell.score}</p>
      {cell.tierPhrase != null && (
        <p className={cn("text-[11px] text-muted-foreground", cell.isTier3 && "italic")}>{cell.tierPhrase}</p>
      )}
      {cell.confidenceWord != null && (
        <p className="text-[11px] text-muted-foreground">{cell.confidenceWord}</p>
      )}
    </div>
  );
}

/** Mirrors `AnalysisTableRow.tsx`'s inline `"posted"` render branch byte-for-byte. */
function PostedValue({ row, failed }: { row: AnalysisListItemIndexed; failed: boolean }) {
  if (failed) {
    return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }
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
}
