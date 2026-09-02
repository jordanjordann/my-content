/** Ticket #289 (TDD §4.3) — thresholds for `buildFailureSummary`'s toast description. */

/** Above this count, reasons are no longer listed individually in the toast. */
export const MAX_TOAST_FAILURE_REASONS = 3;

/** Each individual reason in the joined (2–3 failure) case is truncated to this length. */
export const TOAST_FAILURE_REASON_MAX_LENGTH = 80;

/** Separator joining individual reasons in the 2–3 failure case. */
export const TOAST_FAILURE_REASON_SEPARATOR = " · ";
