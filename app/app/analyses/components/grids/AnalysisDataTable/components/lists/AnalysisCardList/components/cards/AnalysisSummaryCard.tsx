import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AnalysisContentCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell";
import { AnalysisCreatorCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCreatorCell";
import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";
import { AnalysisPerformanceCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisPerformanceCell";
import { AnalysisPostedCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisPostedCell";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import { isNonCompletedRow } from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import type { AnalysisSummaryCardProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/lists/AnalysisCardList/types";

/**
 * Ticket #337 (TDD §6.3, C-6) / owner decision on issue #337 (2026-09-03) — the exact ordered
 * six card fields: the four `LOCKED_COLUMN_IDS` (content, performance, engagementReach,
 * engagementFollowers — never hideable, DESIGN-3C §6.3 / R-12.3.1), plus `creator` (upgraded
 * from optional to owner-required) and `posted`. Labels are read straight off
 * `ANALYSES_TABLE_COLUMNS` — the table's own label source — never retyped, so the card and the
 * table are guaranteed to say the exact same thing for the exact same column.
 */
type CardFieldId = "content" | "performance" | "engagementReach" | "engagementFollowers" | "creator" | "posted";

function findColumnLabel(id: CardFieldId): string {
  return ANALYSES_TABLE_COLUMNS.find((candidate) => candidate.id === id)?.label ?? id;
}

/**
 * PR #348 review, P2 — a `Record<CardFieldId, string>` literal, built once at module scope.
 * A missing (or renamed) `CardFieldId` key is now a `tsc` error at this object literal, not a
 * runtime `throw` that would crash the whole analyses page below 640px if `ANALYSES_TABLE_COLUMNS`
 * ever drops an entry this card depends on.
 */
const CARD_FIELD_LABELS: Record<CardFieldId, string> = {
  content: findColumnLabel("content"),
  performance: findColumnLabel("performance"),
  engagementReach: findColumnLabel("engagementReach"),
  engagementFollowers: findColumnLabel("engagementFollowers"),
  creator: findColumnLabel("creator"),
  posted: findColumnLabel("posted"),
};

/**
 * One stacked card (<640px, design §8) — the phone equivalent of one `AnalysisTableRow`. A
 * real `<button>` (>=44px tall via `min-h-11`) so tap-to-open is native and keyboard-operable.
 * `Enter` is handled explicitly (mirrors `AnalysisTableRow`'s own `<tr>` handling) and calls
 * `preventDefault` so a real browser's own native Enter-triggers-click activation never fires
 * `onOpen` a second time for the same keypress; `onClick` alone covers mouse/touch and Space
 * (native button activation).
 *
 * Field content (Performance, Posted) is rendered by the shared `AnalysisPerformanceCell` /
 * `AnalysisPostedCell` components — the same components `AnalysisTableRow.tsx` uses for the
 * table's own Performance/Posted cells (PR #348 review, P2) — so the two views read from one
 * source and cannot drift out of copy sync.
 *
 * Accessible name (PR #348 review, P2): the button carries NO `aria-label`. Overriding the
 * name with just the title (the previous approach) discards every other field for a screen
 * reader that treats this button as an atomic control — exactly the risk mobile VoiceOver/
 * TalkBack pose, per the review's own AX-tree evidence. Leaving the name unset lets it compute
 * from the button's visible text content (the browser/AT "name from content" algorithm), so
 * Content, Performance, Eng. / reach, Eng. / followers, Creator and Posted are all included in
 * what gets announced — nothing sighted users can see is silently dropped for AT users.
 * `aria-hidden` spans inside (numerals duplicated by a sibling `role="group"` accessible label,
 * decorative pips) are excluded from that computed name, same as they already are on the table.
 * A live-device (iOS VoiceOver / Android TalkBack) confirmation of the resulting utterance is
 * still open — this fix is verified structurally (jsdom / Chromium AX tree), not on a real
 * mobile screen reader; flagged explicitly in the PR rather than silently claimed as done.
 *
 * Deliberate deviation for the "score" branch only: the table's Performance cell embeds
 * `AnalysisScoreExplainPopover`, a real, focusable `<button>`. Nesting a `<button>` inside this
 * card's own whole-card `<button>` is invalid HTML (interactive content cannot contain
 * interactive content) and would let a tap on the inner popover trigger bubble into this
 * card's own `onClick`. `AnalysisPerformanceCell`'s `withExplainTrigger={false}` omits only
 * that interactive trigger — the pips, the `role="group"`/`n out of 5` accessible label, the
 * tier phrase and the confidence word all render identically to the table (DESIGN-3C §5).
 */
export function AnalysisSummaryCard({ row, onOpen }: AnalysisSummaryCardProps) {
  const failed = isNonCompletedRow(row);
  const failedLabel = failed ? (row.status === "failed" ? "Analysis failed" : "Queued") : null;

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
      data-row-id={row.id}
      onClick={() => onOpen(row.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex min-h-11 w-full flex-col gap-3 p-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        failed && "border-l-[3px] border-l-rose-500",
      )}
    >
      <CardField label={CARD_FIELD_LABELS.content}>
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

      <CardField label={CARD_FIELD_LABELS.performance}>
        <AnalysisPerformanceCell row={row} failed={failed} withExplainTrigger={false} />
      </CardField>

      <CardField label={CARD_FIELD_LABELS.engagementReach}>
        {failed || row.tableDerived == null ? (
          <span className="text-[12.5px] text-muted-foreground">—</span>
        ) : (
          <AnalysisEngagementCell cell={row.tableDerived.engagementReachCell} denominator="REACH" />
        )}
      </CardField>

      <CardField label={CARD_FIELD_LABELS.engagementFollowers}>
        {failed || row.tableDerived == null ? (
          <span className="text-[12.5px] text-muted-foreground">—</span>
        ) : (
          <AnalysisEngagementCell cell={row.tableDerived.engagementFollowersCell} denominator="FOLLOWERS" />
        )}
      </CardField>

      <CardField label={CARD_FIELD_LABELS.creator}>
        <AnalysisCreatorCell username={row.username} platform={row.platform} comfortable />
      </CardField>

      <CardField label={CARD_FIELD_LABELS.posted}>
        <AnalysisPostedCell row={row} failed={failed} />
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
