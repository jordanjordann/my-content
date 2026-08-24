/**
 * Ticket #294 — the untrusted-analysis banner's user-facing copy, per module conventions
 * (strings live in `constants.ts`, not inline in the component). Owner sign-off on this exact
 * wording is still pending (#294 review) — do not reword without an explicit owner ruling.
 */
export const UNTRUSTED_ANALYSIS_WARNING_TITLE =
  "Video could not be downloaded — analysis may be unreliable";

export const UNTRUSTED_ANALYSIS_WARNING_BODY =
  "This video could not be downloaded, so the analysis was produced from the title and " +
  "caption only. Anything below that describes the visuals, editing or on-screen moments " +
  "is not reliable and should not be trusted.";
