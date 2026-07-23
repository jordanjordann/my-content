import { SCORECARD_RUBRICS, type ScorecardDimension } from "@/lib/server/analysis/prompts/rubrics";
import { MAX_SCORE } from "@/app/app/analyses/constants";

/**
 * The rubric-band sentence for a specific dimension at a specific score
 * value (design doc §2.2) — e.g. a `4` on `hookStrength` surfaces the exact
 * Indonesian sentence describing what a 4 looks like, not a generic gloss
 * of the dimension. This is the primary mechanism for conveying "AI
 * judgement, not measurement" (design doc §2.2), so it is sourced from
 * `SCORECARD_RUBRICS` — the same rubric the model was scored against —
 * rather than a second, hand-written copy.
 */
export function getRubricSentence(dimension: ScorecardDimension, score: number): string {
  const bands = SCORECARD_RUBRICS[dimension];
  const index = Math.min(Math.max(Math.round(score), 1), MAX_SCORE) - 1;
  return bands[index];
}
