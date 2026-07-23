import { ANALYSIS_SCHEMA_VERSION } from "@/lib/server/analysis/schema/constants";
import type { ContentAnalysis } from "@/lib/server/analysis/types";
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
 */
export function parseContentAnalysis(text: string): ContentAnalysis {
  const parsed: unknown = JSON.parse(text);
  const validated = assertContentAnalysis(parsed);

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
