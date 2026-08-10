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
 * PR #184 re-review, blocker 3: `realNumerals` is limited to the digits
 * inside `ANGKA_ENGAGEMENT` alone (`extractNumerals(angka)` in
 * `prompts/user.ts`) — it does NOT admit the "## Engagement & Technical
 * Context" block's raw figures (likes, comments, followers, the displayed
 * view/play count, the view/play rate), nor duration, resolution, post
 * date, or the slide manifest. An earlier revision of this fix widened the
 * list to admit the five context figures; the reviewer ruled that wrong for
 * two reasons: (1) it was still incomplete — the prompt hands the model
 * several other numbers (duration, slide totals, slide numbers) that were
 * never on any allow-list, so the most likely fabrications (a slide number,
 * a duration) still threw after the Gemini call was billed; (2)
 * `assertNumeralsAreReal` matches VALUES, never labels, so admitting round
 * audience-scale integers is a laundering surface — a model-invented "15.000
 * orang menyimpan video ini" (a saves count nobody supplied) would pass the
 * guard purely by reusing another figure's magnitude. The fix instead
 * narrows Half A's own prompt text (`prompts/user.ts`) to name
 * `ANGKA_ENGAGEMENT` as the ONLY quotable figure — so any other numeral in
 * the model's output is unambiguously a violation of an explicit
 * instruction (genuine drift, which E7/OR-25 accept failing loudly on),
 * rather than the previous "some context figures are fine, others throw"
 * incoherent middle.
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
