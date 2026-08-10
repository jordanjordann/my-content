/**
 * TDD §8.2 (Half B — the runtime prose guard). The guard's job is to prove
 * every numeral in Gemini's Indonesian judgement prose (`verdict` and every
 * `drivers[]` entry) is a number the model was actually given, never one it
 * computed or invented (PRD S2/AC-7).
 *
 * `ComputedPerformanceBlock` here is deliberately narrow — it carries only
 * the real numerals `prompts/user.ts`'s `resolvePerformanceAssessment()`
 * actually hands to the model inside `ANGKA_ENGAGEMENT` (ticket #142's
 * scope). It is NOT the full computed-metrics block TDD §4/§5.1/§7
 * describe (`tierUsed`, `confidence`, `basedOnVideos`, `provisional`,
 * `unavailableReason`, the Tier 2/3 figures) — that assembly is
 * `computeBlock.ts`, owned by #143/#144 and not built yet. Widening this
 * type to match their eventual shape is out of scope here; when they land,
 * this type narrows into a slice of their result (the numeral list) rather
 * than being replaced.
 */
export interface ComputedPerformanceBlock {
  /**
   * Every numeral (as a plain JS number, decoded from whatever Indonesian-
   * or dot-decimal-formatted string the prompt actually rendered) the model
   * was given permission to echo. `assertNumeralsAreReal` treats any
   * numeral in the prose that does not match one of these — within the
   * rounding tolerance below — plus the OR-10 allow-list, as a fabrication.
   */
  realNumerals: number[];
}
