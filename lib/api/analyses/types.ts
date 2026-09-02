import type {
  BeatType,
  CtaTiming,
  CtaType,
  FormatArchetype,
  HookType,
  Pacing,
  TopicNiche,
} from "@/lib/analysis/taxonomy";

export type {
  BeatType,
  CtaTiming,
  CtaType,
  FormatArchetype,
  HookType,
  Pacing,
  TopicNiche,
} from "@/lib/analysis/taxonomy";

export type AnalysisPlatform = "instagram" | "youtube";

export type AnalysisStatus = "pending" | "completed" | "failed";

/**
 * Ticket #149 — mirrors the server's `analysis_mode`
 * (`lib/server/analysis/performance/baseline.ts`'s `AnalysisMode`), which is not itself
 * importable client-side (`lib/server/*`). Duplicated here rather than imported, the same
 * posture `bucketNoun()` (`lib/api/analyses/helpers.ts`) already takes for the same reason.
 * DESIGN-3C §2.1: `full_video` renders no mode chip; `images_only`/`metadata_only` render
 * `Images only`/`Caption only` (AC-13).
 */
export type AnalysisMode = "full_video" | "images_only" | "metadata_only";

/**
 * Classified engagement-count state (TDD §4.1, docs/archive/specs/TDD-engagement-count-display-states.md).
 * Derived once in the query-hook `select` layer from raw `viewCount`/`playCount`/
 * `likeCount`/`likeAndViewCountsDisabled` — components must never branch on the raw
 * fields, only on `state.kind`.
 *
 * - `hidden` — creator disabled view/like counts on this post (State 1).
 * - `zero` — a genuine measured `0` (State 2).
 * - `unknown` — value is `null` / never fetched (State 3).
 * - `count` — a normal non-zero value (views or likes).
 * - `plays` — `viewCount === 0` but a real `playCount` exists; Reels-only, structural
 *   (carousel children have `playCount === null`, not `0`) (State 4).
 */
export type CountState =
  | { kind: "hidden" }
  | { kind: "zero" }
  | { kind: "unknown" }
  | { kind: "count"; value: number }
  | { kind: "plays"; value: number };

/**
 * Ticket #144 (TDD §7, §9.6). Mirrors the server's
 * `lib/server/analysis/performance/types.ts` union-for-union — R-12.3.5 is
 * a type-level requirement carried all the way to the client: `Tier1Ratio`
 * stays a discriminated union here too, never flattened into an optional
 * `denominator` string. Dropping the discriminator is a `tsc` failure at
 * every call site that constructs one, exactly as it is server-side.
 */
export type ReachKind = "PLAYS" | "VIEWS" | "UNKNOWN";
export type ReachDerivedFrom = "TOP_LEVEL" | "CAROUSEL_FIRST_SLIDE" | "NONE";
export type PerformanceAvailabilityState = "AVAILABLE" | "HIDDEN" | "UNKNOWN" | "ZERO";
export type Denominator = "REACH" | "FOLLOWERS";

export type Tier1Ratio =
  | { denominator: "REACH"; ratio: number; reachKind: ReachKind }
  | { denominator: "FOLLOWERS"; ratio: number };

export type Tier = "CREATOR_BASELINE" | "REACH_ONLY" | "AUDIENCE_FALLBACK" | "UNAVAILABLE";
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type ConfidenceReason = "CACHED_FOLLOWER_DENOMINATOR" | "CAROUSEL_FIRST_SLIDE" | "THIN_SAMPLE";
export type UnavailableReason =
  | "REACH_HIDDEN"
  | "REACH_UNKNOWN"
  | "CONTENT_KIND_UNSUPPORTED"
  | "REACH_NOT_ON_FIRST_SLIDE"
  | "NO_AUDIENCE_DATA"
  | "INSUFFICIENT_HISTORY"
  | "CAUSE_NOT_DETERMINABLE";

/**
 * Ticket #252 (DESIGN-3C §3, PR #263 review) — mirrors the server's
 * `lib/server/analysis/performance/readModel.ts`'s `PerformanceTier2State`. The discriminator
 * every `PerformanceTier2` consumer must switch on — never re-derive from `(multiplier,
 * median)` nullness. That inference is exactly what broke down: a `NOT_COMPARABLE` row's own
 * metric unresolved can have `median` `null` (regardless of pool size, DESIGN-3C §3 step 2)
 * yet is not cold start, and a live-measured row can have a stored `multiplier` operand that
 * isn't the frozen column.
 */
export type PerformanceTier2State = "MEASURED" | "NOT_COMPARABLE" | "COLD_START";

/**
 * Mirrors the server's `PerformanceTier2Reason` — always present on `NOT_COMPARABLE`, always
 * `null` elsewhere. `POST_METRIC_UNRESOLVED_NO_BASELINE` (ticket #262) is the below-threshold
 * variant: own metric unresolved AND the creator has no live baseline for this bucket yet.
 */
export type PerformanceTier2Reason =
  | "POST_METRIC_UNRESOLVED"
  | "POST_METRIC_UNRESOLVED_NO_BASELINE"
  | "MEDIAN_ZERO";

export type PerformanceTier2 = {
  /** `null` at Tier 2 cold start, or `NOT_COMPARABLE`/`POST_METRIC_UNRESOLVED` (no median exists yet either way, regardless of pool size). */
  median: number | null;
  sampleSize: number;
  bucketKey: string;
  /** `null` unless `state === "MEASURED"`. */
  multiplier: number | null;
  /**
   * Ticket #260 — the server's `BASELINE_MIN_SAMPLE` threshold, carried per row (mirrors
   * `lib/server/analysis/performance/readModel.ts`'s `PerformanceTier2`). The single source
   * of truth the cold-start progress cell clamps and renders its denominator against.
   */
  minSample: number;
  /** Ticket #252 — see `PerformanceTier2State`'s doc. The single field every consumer switches on. */
  state: PerformanceTier2State;
  /** Non-null iff `state === "NOT_COMPARABLE"`. */
  reason: PerformanceTier2Reason | null;
};

export type PerformanceComputed = {
  reach: {
    value: number | null;
    kind: ReachKind | null;
    derivedFrom: ReachDerivedFrom;
    state: PerformanceAvailabilityState;
  };
  likes: { value: number | null; state: PerformanceAvailabilityState };
  comments: { value: number | null; state: PerformanceAvailabilityState };
  audience: { value: number | null; capturedAt: string; sourceFetchedAt: string | null };
  postAgeHours: number | null;
  tier1: Tier1Ratio | null;
  tier2: PerformanceTier2 | null;
  tier3: { reachPerFollower: number } | null;
  tierUsed: Tier;
  confidence: Confidence;
  confidenceReason: ConfidenceReason | null;
  provisional: boolean;
  unavailableReason: UnavailableReason | null;
};

/**
 * The model's judgement-layer output, lifted out of `result_content` the same way
 * `overallScore`/`scorecard` already are.
 *
 * `verdict` is `string | null` — `null` means no judgement exists for this row (e.g. an
 * `UNAVAILABLE` row, or `result_content` with no `performance` block), consistent with
 * `performanceScore`. Never substitute `""` for absence: the client must be able to
 * distinguish "no judgement" from "the model returned an empty verdict".
 */
export type PerformanceJudgement = {
  performanceScore: number | null;
  verdict: string | null;
  drivers: string[];
};

/** `null` only for rows written before schema 3 (TDD §7) — post-012, none. */
export type AnalysisPerformance = {
  computed: PerformanceComputed;
  judgement: PerformanceJudgement;
} | null;

/**
 * Ticket #145 (PR #198 review, blocker 8) — the analyses table's per-row state-matching /
 * tier-phrase / bucket-noun *decisions*, precomputed once per row in `hooks.ts`'s `select`
 * (AGENTS.md's data-transformation rule) instead of being re-derived on every render inside
 * `AnalysisTableRow`. Cells still own pure number/string DISPLAY formatting (`toFixed`,
 * `formatAbbrev`, template literals) — that is presentation, not derivation, and stays in the
 * component per AGENTS.md's own carve-out.
 */
/**
 * DESIGN-3B §5.5 (amendment B8) — the three states that used to collapse into
 * `{ kind: "reason"; text: null }` are now distinguishable at the type level:
 * - `"no-judgement"` — row 8. A performance block exists, no `unavailableReason` is stored,
 *   and `performanceScore` is `null`. Renders `No 1–5 for this post` and keeps the row's
 *   single `ⓘ`.
 * - `"dash"` — `INSUFFICIENT_HISTORY`, declared on `UnavailableReason` but never produced.
 *   No approved copy exists for it (§5.5); it keeps the muted `—` on purpose.
 * - `"reason"` — every other `UnavailableReason` with approved copy. `text` is always a real
 *   string here; the two `null`-shaped states above have their own discriminants instead.
 */
export type AnalysisTablePerformanceCell =
  | {
      kind: "score";
      score: number;
      tierPhrase: string | null;
      isTier3: boolean;
      confidenceWord: string | null;
    }
  | { kind: "reason"; text: string }
  | { kind: "no-judgement" }
  | { kind: "dash" };

/**
 * Ticket #251 — `vs their usual` cell (col 7). `"not-comparable"` is a THIRD state,
 * distinct from `"cold-start"`: a full baseline exists for this creator/bucket
 * (`sampleSize >= BASELINE_MIN_SAMPLE`) but this specific post's own metric could not be
 * measured against it (`BaselineResult.state === "NOT_COMPARABLE"`,
 * `lib/server/analysis/performance/types.ts`). There is nothing left to "build" — the
 * bare `N of {minSample}` progress framing (R-C1, the cold-start-only
 * framing) must never render here. Statement only — OR-25 (no retry) forbids a button or
 * link on this cell in any state.
 */
export type AnalysisTableMultiplierCell =
  | { kind: "measured"; multiplier: number; sampleSize: number; bucketNoun: string }
  | { kind: "cold-start"; sampleSize: number; minSample: number; bucketNoun: string }
  | {
      kind: "not-comparable";
      reason: "POST_METRIC_UNRESOLVED" | "POST_METRIC_UNRESOLVED_NO_BASELINE" | "MEDIAN_ZERO";
    }
  | { kind: "reason"; text: string | null }
  | { kind: "dash" };

export type AnalysisTableEngagementCell =
  | {
      kind: "value";
      ratio: number;
      denominator: "REACH";
      reachKind: ReachKind;
      reachValue: number | null;
      /** R-D3 (TDD §9.2, DESIGN-3C §4.1) — reach was derived from the carousel's first slide
       * only (D4), never a per-post figure. The cell must append `· first slide only` to its
       * qualifier when this is `true`; the confidence penalty itself is already carried on
       * `computed.confidence`/`confidenceReason`, so this field exists purely to drive the
       * qualifier string, not to re-derive confidence. */
      firstSlideOnly: boolean;
    }
  | { kind: "value"; ratio: number; denominator: "FOLLOWERS"; followersValue: number | null }
  | { kind: "reason"; text: string }
  | { kind: "dash" };

/**
 * Ticket #146 / OR-11 (TDD §9.5) — the three-case reason a Counts-cell figure is absent.
 * Derived, never stored: `deriveAbsentCountReason` in `lib/api/analyses/helpers.ts`. Case 3
 * (`NOT_AVAILABLE`) is the mandatory non-fallback default — fetch failures, private accounts
 * and unseen payload shapes must never be diagnosed as case 1 (Decision 6, R-13.5.2).
 */
export type AbsentCountReason = "CREATOR_DISABLED" | "TYPE_NOT_REPORTED" | "NOT_AVAILABLE";

/** Per-row precomputed table cell decisions (col 4/6/7/8/9) — `null` when `performance` is `null`. */
export type AnalysisTableDerivedPerformance = {
  /** Col 4 (Counts) — reach state sourced from `performance.computed.reach`, never the raw
   * `viewCountState`/`likeCountState` (PR #198 review, blocker 4: those can be genuinely
   * WRONG for a carousel/plays-only reel, not merely absent). */
  reachCountState: CountState;
  /** Col 4 (Counts, comfortable density's likes-line) — ticket #205. Sourced from
   * `performance.computed.comments`, classified the same way `reachCountState` is classified
   * from `performance.computed.reach` (`classifyCommentCountState`) — never a raw stored field,
   * there is none for comments on `AnalysisListItem`. */
  commentCountState: CountState;
  /** Col 4 (Counts) — OR-11's three-case reason (TDD §9.5). Always computed; the Counts cell
   * only renders it when `reachCountState.kind` is `"unknown"` (case 1 always yields `"hidden"`
   * instead, which already carries its own explanation via `EngagementCount`'s tooltip). */
  absentCountReason: AbsentCountReason;
  performanceCell: AnalysisTablePerformanceCell;
  multiplierCell: AnalysisTableMultiplierCell;
  engagementReachCell: AnalysisTableEngagementCell;
  engagementFollowersCell: AnalysisTableEngagementCell;
  /**
   * Ticket #147 / TDD §9.4 point 4, DESIGN-3B §3.1 — the score-explain popover's
   * deterministic "these disagree" line, `null` when the score and the multiplier point the
   * same way (or either is absent). Computed once here, in the `select` derivation layer,
   * not in the popover component — same rule PR #198 established for the tier phrase.
   */
  disagreementLine: string | null;
  /**
   * Ticket #149 / DESIGN-3C §2.1 — parsed from `performance.computed.tier2.bucketKey`'s
   * `platform:mediaType:analysisMode` segments (the same field `bucketNoun()` already parses),
   * never guessed and never a new stored/fetched field. `null` when `tier2` itself is `null`
   * (no performance block, or a pre-schema-3 row) — the Content cell renders no mode chip in
   * that case rather than fabricate one. Drives the Content cell's mode chip (AC-13) — `Caption
   * only` for `metadata_only`, `Images only` for `images_only`, no chip for `full_video`.
   */
  analysisMode: AnalysisMode | null;
};

export type AnalysesPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AnalysisListItem = {
  id: string;
  prompt: string | null;
  status: AnalysisStatus;
  url: string;
  platform: AnalysisPlatform;
  mediaType: "reel" | "post" | "carousel" | "short";
  username: string;
  overallScore: number | null;
  scorecard: Scorecard | null;
  /**
   * Version of the analysis result contract this row was produced under
   * (TDD §3.3). `null` on rows that predate the redesign — the UI must
   * degrade gracefully (e.g. skip rendering the new Tier 1 style section)
   * rather than assume the current shape when this isn't the version it
   * knows how to render.
   */
  schemaVersion: number | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  playCount: number | null;
  likeCount: number | null;
  /** `null` means "unknown" (not fetched / not yet backfilled) — never coerce to `false`. */
  likeAndViewCountsDisabled: boolean | null;
  postDate: string | null;
  durationSec: number | null;
  caption: string | null;
  title: string | null;
  createdAt: string;
  /** Ticket #144 (TDD §7) — purely additive. `null` only for pre-schema-3 rows (none exist post-012). */
  performance: AnalysisPerformance;
  /**
   * Ticket #149 — `formatArchetype`/`hookType` for the optional Style column (Q3, DESIGN-3C
   * §6.3, OR-5). Purely additive: `result_content` was already being fetched and parsed for
   * `overallScore`/`scorecard` (`app/api/analyses/route.ts`'s `parseResultContent`) — this
   * lifts `style` out the same way, no new DB read, no schema change. `null` when no analysis
   * result exists yet (pending/failed) or the row predates the redesign.
   */
  style: StyleAttributes | null;
};

/**
 * `AnalysisListItem` with a precomputed, normalized search index over title/caption/prompt,
 * plus the classified `CountState` for views and likes (derived once in `select`, TDD §4.3).
 */
export type AnalysisListItemIndexed = AnalysisListItem & {
  searchText: string;
  viewCountState: CountState;
  likeCountState: CountState;
  /** `null` iff `performance` is `null` (failed/pending rows, or pre-schema-3). */
  tableDerived: AnalysisTableDerivedPerformance | null;
};

/**
 * The analysis result contract, mirrored exactly from the server's
 * `lib/server/analysis/types/analysis.ts` (TDD §3.2, §8.2). `Patterns`
 * (`viralFormulas`, `audiencePsychology`, `recurringRedFlags`) is DELETED —
 * `viralFormulas`/`audiencePsychology` decompose into `StyleAttributes`
 * below; `recurringRedFlags` survives, renamed to the flat `redFlags`.
 */

export type StructureBeat = {
  timestampSec: number;
  beatType: BeatType;
  description: string; // Indonesian
};

/** Tier 1 — style attributes. The primary payload. */
export type StyleAttributes = {
  topicNiche: TopicNiche;
  topicSubtopic: string; // Indonesian free text
  formatArchetype: FormatArchetype;
  hookType: HookType;
  hookTypeSecondary: HookType | null;
  hasAudienceCallout: boolean;
  hookText: string; // Indonesian, verbatim
  structureBeatMap: StructureBeat[];
  pacing: Pacing;
  estimatedCutsPerMinute: number | null;
  ctaType: CtaType[]; // never empty; ["NONE"] means no CTA
  ctaTiming: CtaTiming;
  onScreenText: string[]; // Indonesian, verbatim, in order
  captionStyleNotes: string; // Indonesian prose
  verbalTonePatterns: string[]; // Indonesian short tags
};

/** Tier 2 — 7 dimensions, each an integer 1-5. */
export type Scorecard = {
  hookStrength: number;
  retentionFlow: number;
  visualPolish: number;
  ctaEffectiveness: number;
  messageClarity: number;
  originality: number;
  emotionalResonance: number;
};

export type ContentAnalysis = {
  schemaVersion: number;
  style: StyleAttributes;
  overallScore: number; // 1-5
  scorecard: Scorecard;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  keyMoments: string[];
  redFlags: string[]; // renamed from patterns.recurringRedFlags
  suggestions: string[];
};

export type AnalysisDetail = {
  id: string;
  prompt: string | null;
  status: AnalysisStatus;
  title: string | null;
  url: string;
  platform: AnalysisPlatform;
  mediaType: "reel" | "post" | "carousel" | "short";
  username: string;
  thumbnailUrl: string | null;
  viewCount: number | null;
  playCount: number | null;
  likeCount: number | null;
  /** `null` means "unknown" (not fetched / not yet backfilled) — never coerce to `false`. */
  likeAndViewCountsDisabled: boolean | null;
  postDate: string | null;
  caption: string | null;
  durationSec: number | null;
  results: ContentAnalysis | null;
  createdAt: string;
  /** Ticket #144 (TDD §7) — purely additive. `null` only for pre-schema-3 rows (none exist post-012). */
  performance: AnalysisPerformance;
  /**
   * Ticket #294 — the STORED `analyses.analysis_mode` column, read straight off the row
   * (`lib/server/db.ts`'s `getAnalysisDetail`). Deliberately separate from the derived,
   * tier2-bucket-key-parsed `AnalysisMode` (`AnalysisTableDerivedPerformance.analysisMode`,
   * used only for the table's cosmetic `Caption only`/`Images only` chip): that derivation is
   * `null` whenever `tier2` is absent, which is the wrong failure mode for a correctness
   * signal. A banner asserting "this analysis may be fabricated" must read the fact recorded
   * when the row was written, never a value re-derived from an unrelated performance bucket.
   * `null` on rows written before `analysis_mode` existed (nullable column, no backfill).
   */
  storedAnalysisMode: AnalysisMode | null;
};

/** `AnalysisDetail` plus the classified `CountState` for views and likes (TDD §4.3). */
export type AnalysisDetailClassified = AnalysisDetail & {
  viewCountState: CountState;
  likeCountState: CountState;
  /**
   * Ticket #294 — `true` iff `platform === "youtube"` AND `storedAnalysisMode ===
   * "metadata_only"`: the video was never downloaded (yt-dlp bot-blocked), so Gemini ran on
   * the caption/title alone and any visual claims in the result are fabricated. Computed once
   * here (`lib/api/analyses/helpers.ts`'s `isUntrustedYoutubeMetadataOnly`) per AGENTS.md's
   * data-transformation rule — the modal only branches on this flag, never re-derives it.
   */
  isUntrustedYoutubeMetadataOnly: boolean;
};

export type AnalysesListResponse = {
  analyses: AnalysisListItem[];
  accounts: string[];
  pagination: AnalysesPagination;
};

export type GetAnalysesParams = {
  page?: number;
  /**
   * B4 (PR #196 review) — optional override of the server's default page
   * size (50). The OLD `/app/analyses` page's `useAllAnalysesQuery` (see
   * `lib/api/analyses/hooks.ts`) sets this to `ANALYSES_FETCH_ALL_PAGE_SIZE`
   * so its client-side filters search the full corpus, not one page.
   */
  pageSize?: number;
};

export type AnalyzeResponse = {
  analysisIds: string[];
  analysesCreated: number;
  failedUrls: { url: string; index: number; error: string }[];
  error?: string;
};

/** One failed URL, normalised for display. Ticket #289. */
export type AnalyzeFailure = {
  url: string;
  /** The server's own reason from `AnalyzeResponse.failedUrls[].error`, never a generic stand-in. */
  reason: string;
};

/**
 * `AnalyzeResponse` after hook-layer transformation (`toAnalyzeOutcome`,
 * `lib/api/analyses/helpers.ts`). Ticket #289 — the shape `AnalysesContent`'s `onSuccess`
 * consumes; no further reshaping happens in the UI layer.
 */
export type AnalyzeOutcome = {
  analysisIds: string[];
  created: number;
  /** Number of URLs submitted — the denominator the progress panel shows. */
  requested: number;
  failures: AnalyzeFailure[];
};

export type DeleteResponse = { success: true };
