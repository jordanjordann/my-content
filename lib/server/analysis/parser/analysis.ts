import { computePerformanceAssessmentBlock } from "@/lib/server/analysis/prompts";
import { assertPerformanceProseIsSafe } from "@/lib/server/analysis/prose";
import { ANALYSIS_SCHEMA_VERSION } from "@/lib/server/analysis/schema/constants";
import type { ComputedPerformanceBlock } from "@/lib/server/analysis/performance/types";
import type { ContentAnalysis, MediaMetadata } from "@/lib/server/analysis/types";
import { assertContentAnalysis } from "./validation";

/**
 * TDD §4.4. Under `responseMimeType: "application/json"` (#66) the response
 * body IS JSON, full stop — `extractJson()` (regex brace-hunting / code-fence
 * stripping) is deleted. A `SyntaxError` from `JSON.parse` is a thrown error,
 * never a recovery path: truncation is caught upstream in #66 (the generate
 * layer throws on `finishReason !== "STOP"` before the body ever reaches
 * here), but if a truncated/malformed body ever does reach this function, the
 * resulting `SyntaxError` must propagate unchanged. No repair path is added
 * here as a safety net.
 *
 * TDD §8.2 (Half B): the prose guard runs here, in the parser stage, BEFORE
 * persistence — `assertPerformanceProseIsSafe` throws loudly
 * (`ProseQualifierError`/`NumeralFabricationError`) on a bare unqualified
 * percentage or a fabricated numeral in `performance.verdict`/`drivers[]`.
 * No stripping, no rewriting, no automatic repair retry (§8.2/§8.3). The
 * computed block it checks against is the SAME `ComputedPerformanceBlock`
 * (`computeBlock.ts`) the prompt was built from
 * (`computePerformanceAssessmentBlock`, `prompts/user.ts`) — passed through
 * from the pipeline, never a second, independently-derived figure (ticket
 * #143 — `computeBlock.ts` is computed exactly once per analysis, including
 * its one DB read for the Tier 2 baseline).
 */
export function parseContentAnalysis(
  text: string,
  metadata: MediaMetadata,
  computedBlock: ComputedPerformanceBlock,
): ContentAnalysis {
  const parsed: unknown = JSON.parse(text);
  const validated = assertContentAnalysis(parsed);

  assertPerformanceProseIsSafe(
    validated.performance,
    computePerformanceAssessmentBlock(metadata, computedBlock),
  );

  // [TAXONOMY] instrumentation (TDD §4.6, PRD §4.3.5/§4.3.6): one structured
  // log line per completed analysis carrying the classified values, so the
  // OTHER-rate and ["NONE"]-rate are queryable via json_extract on
  // analyses.result_content (query recorded in TDD §4.6) without a dashboard.
  console.info("[TAXONOMY]", {
    topicNiche: validated.style.topicNiche,
    hookType: validated.style.hookType,
    formatArchetype: validated.style.formatArchetype,
    ctaType: validated.style.ctaType,
  });

  return {
    // Stamped server-side (TDD §4.4 step 3) — the model has no business
    // asserting which contract it was run under.
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    ...validated,
  };
}
