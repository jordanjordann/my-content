/**
 * TDD §8.2 (Half B — the runtime prose guard). The guard's job is to prove
 * every numeral in Gemini's Indonesian judgement prose (`verdict` and every
 * `drivers[]` entry) is a number the model was actually given, never one it
 * computed or invented (PRD S2/AC-7).
 *
 * `ComputedPerformanceBlock` here is deliberately narrow — it carries only
 * the real numerals `prompts/user.ts`'s `resolvePerformanceAssessment()`
 * actually hands to the model (ticket #142's scope). It is NOT the full
 * computed-metrics block TDD §4/§5.1/§7 describe (`tierUsed`, `confidence`,
 * `basedOnVideos`, `provisional`, `unavailableReason`, the Tier 2/3
 * figures) — that assembly is `computeBlock.ts`, owned by #143/#144 and not
 * built yet. Widening this type to match their eventual shape is out of
 * scope here; when they land, this type narrows into a slice of their
 * result (the numeral list) rather than being replaced.
 *
 * PR #184 review, blocker 3: `realNumerals` is NOT limited to the digits
 * inside `ANGKA_ENGAGEMENT` — it also carries every raw figure the
 * "## Engagement & Technical Context" block (directly above the
 * performance block in the same prompt) already handed the model: likes,
 * comments, followers, the displayed view/play count, and the view/play
 * rate. Half A's own instruction text ("never restate any number you were
 * not explicitly given above") already permits a driver to quote those —
 * they ARE explicitly given, just one section higher. Narrowing this list
 * to `ANGKA_ENGAGEMENT`'s digits alone made compliant prose throw
 * `NumeralFabricationError` *after the Gemini call was billed* whenever a
 * driver quoted a context figure verbatim (e.g. "15.000 suka"), which is
 * a guaranteed-failure-on-compliant-output bug, not a drift signal E7/OR-25
 * is meant to catch. Widening this list (rather than narrowing Half A's
 * prompt text to forbid quoting context figures) was the chosen fix: it
 * makes the guard's allow-list match what the prompt actually promises,
 * without reducing what a well-behaved model may truthfully say.
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
