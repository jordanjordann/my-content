/**
 * Types for the performance module (TDD §2 module placement, §6 type
 * unions). `Tier`, `Confidence`, `ConfidenceReason`, `UnavailableReason` and
 * `ComputedPerformanceBlock` are ticket #143's (3B-5) — declared here per
 * TDD §2's module map (`types.ts` is the single source of truth for the
 * whole module, not `judgement.ts`/`computeBlock.ts` individually).
 */

/**
 * R-4.3.1: every stored/displayed reach value carries a kind, and the UI
 * and Gemini prose must use the matching word — a play count must never
 * be labelled "Views". `null` (not a member of this union) is reserved for
 * "no reach field exists at all" (`derivedFrom: "NONE"`) — a fundamentally
 * different fact from "we read a field but couldn't trust its value"
 * (`kind: "UNKNOWN"`).
 */
export type ReachKind = "PLAYS" | "VIEWS" | "UNKNOWN";

/**
 * What `resolveReach()` derived the post-level reach figure from (TDD §3 /
 * §5.2). Read by the confidence ladder (judgement.ts, out of scope here) —
 * `CAROUSEL_FIRST_SLIDE` costs a confidence demotion (D4).
 */
export type ReachDerivedFrom = "TOP_LEVEL" | "CAROUSEL_FIRST_SLIDE" | "NONE";

/**
 * The four-state availability model (PRD §4.4 / TDD §5.4), shared by reach,
 * likes and comments. `ZERO` is only ever assertable when a field is
 * explicitly present as 0 AND uncontradicted by a sibling field AND the
 * disabled flag (where one exists) is confirmed false — never inferred
 * from absence.
 */
export type AvailabilityState = "AVAILABLE" | "HIDDEN" | "UNKNOWN" | "ZERO";

/**
 * DESIGN-3C-analyses-table.md §5.4, R-N1/R-N2/R-N3 (OR-26 / ticket #155,
 * scope note carried into #143's blocker by PR #162). Carousel only.
 * Replaces the additive `someSlideHasReach: boolean` this field used to be
 * (PR #158/#161) — a boolean says a count *exists* on a later slide, it
 * cannot say *what it is*, and R-N1 makes the figure itself mandatory: "no
 * figure, no state" — `REACH_NOT_ON_FIRST_SLIDE` must not render off a bare
 * boolean.
 *
 * A **discriminated union**, not an object with optional `value`/`kind`
 * fields, so R-N2 ("value and kind travel together; a value without an
 * established kind must not be renderable") is a `tsc` failure to violate,
 * not a doc comment to remember — the same discipline `BaselineResult`
 * adopted in PR #159 after a doc-comment-only guard proved insufficient
 * there. `{ usable: true, value }` with no `kind` does not type-check; the
 * `usable: false` branch has no path to a value at all.
 *
 * `kind` excludes `"UNKNOWN"` deliberately (R-N2's second half): a later
 * slide whose reach kind cannot be established must degrade the whole
 * union to `{ usable: false }` (which #143 must read as
 * `CAUSE_NOT_DETERMINABLE`, not print an unlabelled number) rather than
 * carry a value paired with `kind: "UNKNOWN"`.
 *
 * `slideIndex` is the 0-based index into the carousel's PRE-FILTER `edges`
 * array (R-N4 — "nice-to-have, not a requirement"; it falls out of the scan
 * in `reach.ts` at no extra cost, so it is carried). Consumers add 1 for the
 * mockup's one-based "slide 6" copy.
 *
 * Deliberately NOT an index into the filtered child array
 * (`edges.map(e => e.node).filter(Boolean)`): a null `edge.node` anywhere
 * before the usable slide would silently shift every later index down by
 * one, printing a confidently wrong slide number ("slide 6" for what is
 * actually the 7th slide the user sees). `edges` — including any null-node
 * entries — is the array whose positions match what a viewer actually sees
 * scrolling the carousel, so it is the only array `slideIndex`/`slideCount`
 * may be derived from (follow-up to PR #164's review, item 1/2).
 *
 * `slideCount` MUST be drawn from that SAME `edges` array
 * (`edges.length`, pre-filter) — never from the filtered children array.
 * Pairing a `slideIndex` from `edges` with a `slideCount` from the filtered
 * array would produce a different, equally confident wrong number
 * ("slide 6 of 9" when the carousel actually has 10 slides).
 *
 * Both fields are **required**, not optional: every production construction
 * site (`resolveLaterSlideReach` in `reach.ts`) sets them — there is no
 * producer that scans children without knowing its own position and the
 * total it scanned. Optionality would force every consumer into a `??`
 * fallback for a case that cannot occur.
 */
export type LaterSlideReach =
  | { usable: false }
  | {
      usable: true;
      /** Never negative. The value `resolveNodeReach` (view authority) resolved for this slide. */
      value: number;
      /** Never `"UNKNOWN"` — see the type-level note above (R-N2). */
      kind: Exclude<ReachKind, "UNKNOWN">;
      /** 0-based index into the carousel's pre-filter `edges` array — the user-visible slide position. */
      slideIndex: number;
      /** Total user-visible slide count (`edges.length`, pre-filter) — the SAME array `slideIndex` is drawn from. */
      slideCount: number;
    };

/** Result of `resolveReach()` / `resolveInstagramReach()` / `resolveYoutubeReach()`. */
export interface ReachResult {
  /** Never negative. `null` whenever `state !== "AVAILABLE" && state !== "ZERO"`. */
  value: number | null;
  /** `null` only when `derivedFrom === "NONE"` — no reach field exists at all. */
  kind: ReachKind | null;
  state: AvailabilityState;
  derivedFrom: ReachDerivedFrom;
  /**
   * OR-26 / ticket #155 / DESIGN-3C §5.4. Carousel only. `{ usable: true,
   * value, kind, slideIndex, slideCount }` when slide 0 carries neither reach key but
   * some **later** slide resolves a genuinely usable count (R-N3: the
   * FIRST later slide that does — never a sum, max or mean across slides).
   * `{ usable: false }` on every non-carousel path, every YouTube path, and
   * every carousel where no later slide resolves usably. This field does
   * not itself change `derivedFrom`, which stays `"NONE"` either way
   * (OR-26: the split lives in `perf_unavailable_reason`, not
   * `perf_reach_derived_from`).
   */
  laterSlideReach: LaterSlideReach;
  /**
   * PR #191 review, blocker B1: whether this post structurally carries
   * video content ANYWHERE — a fact `derivedFrom === "NONE"` alone cannot
   * answer. `derivedFrom: "NONE"` only means "slide 0 (or the top-level
   * node) carries neither reach key"; a carousel with an image on slide 0
   * and a video on slide 3 also lands there (that is exactly the shape
   * `resolveLaterSlideReach()` exists to keep scanning past). Conflating
   * the two — as `prompts/user.ts` used to (`isImageOnly = derivedFrom ===
   * "NONE"`) — told a video-bearing carousel "this is image-only content,
   * no reach data exists", a confident, wrong, user-facing statement.
   *
   * `true` whenever ANY node in the post (the top-level node, or any
   * carousel child, first slide or not) carries the `video_play_count`/
   * `video_view_count` reach KEYS — the SAME field-presence discriminator
   * `hasReachFields()`/R-12.7.1 already uses to decide `derivedFrom` — not
   * a second, independent "is this video" inference. `false` only when NO
   * node in the post carries either key: a single image post, or a
   * carousel every one of whose slides is an image. Deliberately
   * independent of whether that video's own reach VALUE is usable — a
   * video slide with `video_view_count: null` still makes `hasVideo` true;
   * "no trustworthy number for this video" and "no video" are different
   * facts (R-4.3.1's discipline, extended to content-kind).
   */
  hasVideo: boolean;
}

/** Result of a count-availability resolver (`availability.ts`). */
export interface CountAvailabilityResult {
  /** Never negative. `null` whenever `state !== "AVAILABLE" && state !== "ZERO"`. */
  value: number | null;
  state: AvailabilityState;
}

/** R-12.2.2 / R-12.2.5: the denominator a Tier 1 ratio is expressed against. */
export type Denominator = "REACH" | "FOLLOWERS";

/**
 * R-12.3.5: a discriminated union, not an object with an optional
 * `denominator` string — dropping the discriminator on construction is a
 * `tsc` failure, not a silent presentation bug. Precedent: PR #122's
 * type-level guard on the fingerprint client.
 */
export type Tier1Ratio =
  | { denominator: "REACH"; ratio: number; reachKind: ReachKind }
  | { denominator: "FOLLOWERS"; ratio: number };

export type ReachDenominatedRatio = Extract<Tier1Ratio, { denominator: "REACH" }>;
export type FollowerDenominatedRatio = Extract<Tier1Ratio, { denominator: "FOLLOWERS" }>;

/** Tier 3 (PRD §5.1 / TDD §7) — always follower-denominated by construction, so no discriminant is needed. */
export interface Tier3Ratio {
  reachPerFollower: number;
}

/**
 * Ticket #141 (TDD §6, PRD §3.3 / §12.4). What a Tier 2 baseline candidate
 * is actually measured against — **not** the same axis as `Denominator`
 * above (which is about Tier 1's `REACH`/`FOLLOWERS` ratio). Tier 2 never
 * needs a follower count at all (PRD §12.4): a post with resolved reach is
 * compared against the bucket's median reach; a post with no reach (an
 * all-image carousel, a single image post) is compared against the
 * bucket's median `likes + comments`. R-4.3.2/R-12.3.2 forbid a baseline
 * set from mixing the two.
 */
export type BaselineDenominator = "REACH" | "ENGAGEMENT_COUNT";

/**
 * Result of `computeBaseline()` (`baseline.ts`). `sampleSize` is **never
 * null** (R-8.4.4/R-13.3.4) — it is the count of prior mature, same-bucket,
 * same-schema-version analyses this creator has, even at zero.
 *
 * **Three states, not two** (post-#154-review correction — the prior doc
 * comment here claimed `median`/`multiplier` were "both non-null at or
 * above `BASELINE_MIN_SAMPLE`", which stopped being true the moment
 * per-post exclusion (`metricFor()`) shipped: a full baseline can exist
 * while THIS post's own metric is unresolvable). A discriminated union on
 * `state`, not a comment, is the guard: a consumer (ticket #142) that
 * switches on `state` physically cannot render `NOT_COMPARABLE` as
 * `COLD_START` by accident, because there is no `median`/`multiplier`
 * nullness inference left to get wrong.
 *
 * - `"COLD_START"` — fewer than `BASELINE_MIN_SAMPLE` comparable prior
 *   analyses exist (TDD §6 step 5). No baseline exists yet. `median` and
 *   `multiplier` do not exist on this variant — there is no value to be
 *   null, there is no baseline. This is the ONLY state in which "N of
 *   `BASELINE_MIN_SAMPLE` posts" framing is accurate.
 * - `"MEASURED"` — a full baseline exists (`sampleSize >=
 *   BASELINE_MIN_SAMPLE`) and this specific post's own metric was
 *   resolvable against it. `median` and `multiplier` are both non-null
 *   numbers.
 * - `"NOT_COMPARABLE"` — a full baseline exists (`sampleSize >=
 *   BASELINE_MIN_SAMPLE`, `median` is a non-null number — the creator
 *   genuinely has enough history) but no multiplier could be produced for
 *   *this* post. `multiplier` does not exist on this variant (see below).
 *   `reason` says why:
 *     - `"POST_METRIC_UNRESOLVED"` — this post's own reach/engagement
 *       count for the bucket's denominator is unavailable (e.g. its own
 *       reach is hidden). Takes priority over `"MEDIAN_ZERO"` below: an
 *       unresolved numerator can't be multiplied no matter what the
 *       median is.
 *     - `"MEDIAN_ZERO"` — this post's own metric DID resolve, but the
 *       bucket's median is exactly `0` (every comparator scored zero on
 *       this denominator). Division is undefined, not "1×" or "0×", so
 *       there is no multiplier to report rather than a fabricated number.
 *
 * A consumer MUST switch on `state`; treating `multiplier === null` alone
 * as "cold start" is exactly the bug this type closes off.
 *
 * **`median`/`multiplier` are dropped, not typed `null`, on the variants
 * where they don't apply (post-#159-review correction).** The first cut of
 * this union kept `median: null` / `multiplier: null` on `COLD_START` and
 * `multiplier: null` on `NOT_COMPARABLE`, reasoning that the union already
 * blocked the illegal *value* combination (you cannot construct a
 * `COLD_START` with a non-null median). That is true but insufficient: with
 * the field present-but-null on every variant, the un-narrowed union type
 * for `baseline.multiplier` is still `number | null` — `tsc` happily
 * compiles `if (baseline.multiplier === null) renderColdStart(...)` on an
 * un-narrowed `BaselineResult`, which is exactly the #142 misreport this
 * type exists to make impossible (telling a creator "2 of 5 posts" when a
 * full baseline exists and only this post's own metric is unmeasurable).
 * Dropping the fields entirely turns any un-narrowed `.multiplier` access
 * into a `tsc` error; the only way to reach a `multiplier` is a `state`
 * check that narrows to `"MEASURED"`, where it is typed `number`, not
 * `number | null`.
 */
export type BaselineResult =
  | {
      state: "COLD_START";
      bucketKey: string;
      sampleSize: number;
    }
  | {
      state: "MEASURED";
      bucketKey: string;
      sampleSize: number;
      median: number;
      multiplier: number;
    }
  | {
      state: "NOT_COMPARABLE";
      bucketKey: string;
      sampleSize: number;
      median: number;
      reason: "POST_METRIC_UNRESOLVED" | "MEDIAN_ZERO";
    };

/**
 * Exhaustiveness helper (PR #159 review, item 2). Call this in the `default`
 * (or final `else`) branch of a `switch (result.state)` over `BaselineResult`
 * (or any other closed union). If a fourth state is ever added to the union
 * without updating every switch, the argument at the call site stops being
 * assignable to `never` and the build fails at compile time — the switch
 * cannot silently fall through to a stale default at runtime instead.
 *
 * @example
 * switch (result.state) {
 *   case "COLD_START": return renderColdStart(result);
 *   case "MEASURED": return renderMeasured(result);
 *   case "NOT_COMPARABLE": return renderNotComparable(result);
 *   default: return assertNever(result);
 * }
 */
export function assertNever(value: never): never {
  throw new Error(`assertNever: unreachable case reached with value ${JSON.stringify(value)}`);
}

/**
 * OR-13 (PRD §5.2 / TDD §4). Which of the three graceful-degradation tiers
 * (PRD §3.3) actually produced `performanceScore`. `REACH_ONLY` covers BOTH
 * a reach-denominated Tier 1 ratio AND a follower-denominated one (all-image
 * content, §12.2) — DESIGN-3B §3.1 is explicit that the enum does not carry
 * that distinction; the L1 phrase does, keyed off `Tier1Ratio.denominator`,
 * not off `tierUsed`. `AUDIENCE_FALLBACK` is Tier 3 (`reach ÷ followers`) —
 * never applicable to content with no reach at all (§12.5's table).
 */
export type Tier = "CREATOR_BASELINE" | "REACH_ONLY" | "AUDIENCE_FALLBACK" | "UNAVAILABLE";

/** OR-13 (PRD §5.2 / TDD §4). `NONE` iff `tierUsed === "UNAVAILABLE"`. */
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

/**
 * TDD §4's confidence ladder — the three demotion causes, matching
 * `perf_confidence_reason`'s `CHECK` (migration 012) exactly. `null` when
 * confidence is `HIGH` (nothing demoted it) or `NONE` (no score at all).
 */
export type ConfidenceReason = "CACHED_FOLLOWER_DENOMINATOR" | "CAROUSEL_FIRST_SLIDE" | "THIN_SAMPLE";

/**
 * TDD §5.3 (seven members, OR-26). `unavailableReason` has TWO origins
 * (TDD §4's "two origins, not one" subsection, binding on #143):
 *
 *   - Path A — resolved inside `judgement.ts`: `REACH_HIDDEN`,
 *     `CAUSE_NOT_DETERMINABLE`, `REACH_UNKNOWN`, `CONTENT_KIND_UNSUPPORTED`,
 *     `NO_AUDIENCE_DATA`, `INSUFFICIENT_HISTORY`.
 *   - Path B — decided upstream in `reach.ts` (`resolveLaterSlideReach()`,
 *     `ReachResult.laterSlideReach`) and only MAPPED here:
 *     `REACH_NOT_ON_FIRST_SLIDE`. `judgement.ts` reads
 *     `laterSlideReach.usable` — it must never re-derive Path B, and
 *     `reach.ts` must never import this type (the mapping is
 *     one-directional).
 *
 * `null` iff a score was produced (`tierUsed !== "UNAVAILABLE"`).
 */
export type UnavailableReason =
  | "REACH_HIDDEN"
  | "REACH_UNKNOWN"
  | "CONTENT_KIND_UNSUPPORTED"
  | "REACH_NOT_ON_FIRST_SLIDE"
  | "NO_AUDIENCE_DATA"
  | "INSUFFICIENT_HISTORY"
  | "CAUSE_NOT_DETERMINABLE";

/**
 * TDD §2 module map / §5.1-§5.2 (OR-13). The full frozen computed block —
 * written by code, never by Gemini (D2) — that `computeBlock.ts` produces
 * and `pipeline/index.ts` persists verbatim to the `perf_*` columns
 * (migration 012/013). This is deliberately a DIFFERENT type from
 * `lib/server/analysis/prose`'s `ComputedPerformanceBlock` (that one is
 * narrowly the prose guard's numeral allow-list, #142's scope) — same name,
 * different module, never imported together without an alias.
 */
export interface ComputedPerformanceBlock {
  reach: ReachResult;
  likeState: AvailabilityState;
  commentState: AvailabilityState;
  /** Null whenever no denominator-bearing ratio could be computed (R-12.2.2/R-12.2.4). */
  tier1Ratio: Tier1Ratio | null;
  /** Null on every content kind with no reach at all (Tier 3 never applies there, §12.5). */
  tier3Ratio: Tier3Ratio | null;
  bucketKey: string;
  baseline: BaselineResult;
  /** Hours between `postDate` and analysis time. `null` when `postDate` is unresolvable. */
  postAgeHours: number | null;
  /** Copy of `profiles.last_fetched_at` at write time (§1.3) — `null` when no profile resolved. */
  audienceSourceFetchedAt: string | null;
  tierUsed: Tier;
  confidence: Confidence;
  confidenceReason: ConfidenceReason | null;
  /** `basedOnVideos` — always `baseline.sampleSize`, never null (R-8.4.4/R-13.3.4). */
  basedOnVideos: number;
  provisional: boolean;
  unavailableReason: UnavailableReason | null;
}
