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
 * Classified engagement-count state (TDD §4.1, docs/TDD-engagement-count-display-states.md).
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
};

/**
 * `AnalysisListItem` with a precomputed, normalized search index over title/caption/prompt,
 * plus the classified `CountState` for views and likes (derived once in `select`, TDD §4.3).
 */
export type AnalysisListItemIndexed = AnalysisListItem & {
  searchText: string;
  viewCountState: CountState;
  likeCountState: CountState;
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
};

/** `AnalysisDetail` plus the classified `CountState` for views and likes (TDD §4.3). */
export type AnalysisDetailClassified = AnalysisDetail & {
  viewCountState: CountState;
  likeCountState: CountState;
};

export type AnalysesListResponse = {
  analyses: AnalysisListItem[];
  accounts: string[];
};

export type AnalyzeResponse = {
  analysisIds: string[];
  analysesCreated: number;
  failedUrls: { url: string; index: number; error: string }[];
  error?: string;
};

export type DeleteResponse = { success: true };
