import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
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
