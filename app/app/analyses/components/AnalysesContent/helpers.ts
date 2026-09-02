import type { AnalyzeFailure } from "@/lib/api/analyses/types";
import {
  MAX_TOAST_FAILURE_REASONS,
  TOAST_FAILURE_REASON_MAX_LENGTH,
  TOAST_FAILURE_REASON_SEPARATOR,
} from "./constants";

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

/**
 * Ticket #289 (TDD §4.3) — builds the toast description for a batch's failures. The progress
 * panel is the full record (every failure, always); this is the short-form summary appended
 * to the toast, which is unreadable if it repeats every reason for a large batch.
 *
 * - 0 failures  -> "" (caller omits the clause entirely)
 * - 1 failure   -> the reason verbatim
 * - 2-3 failures -> reasons joined with " · ", each truncated to 80 chars
 * - 4+ failures -> "${n} URLs failed — see the progress panel for details"
 */
export function buildFailureSummary(failures: AnalyzeFailure[]): string {
  if (failures.length === 0) return "";
  if (failures.length === 1) return failures[0].reason;

  if (failures.length <= MAX_TOAST_FAILURE_REASONS) {
    return failures
      .map((f) => truncate(f.reason, TOAST_FAILURE_REASON_MAX_LENGTH))
      .join(TOAST_FAILURE_REASON_SEPARATOR);
  }

  return `${failures.length} URLs failed — see the progress panel for details`;
}
