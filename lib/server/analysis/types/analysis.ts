import type {
  BeatType,
  CtaTiming,
  CtaType,
  FormatArchetype,
  HookType,
  Pacing,
  TopicNiche,
} from "@/lib/analysis/taxonomy";

/**
 * The analysis result contract (TDD §3.2). Rewritten by #68 off the
 * pre-redesign 1-10/7-old-dimension shape.
 *
 * `Patterns` (`viralFormulas`, `audiencePsychology`, `recurringRedFlags`) is
 * DELETED entirely — `viralFormulas`/`audiencePsychology` do not survive in
 * any form [PRD §4.1]; they decompose into Tier 1 `StyleAttributes` fields.
 * `recurringRedFlags` survives, renamed to the flat `redFlags` on
 * `ContentAnalysis`.
 */

export interface StructureBeat {
  timestampSec: number;
  beatType: BeatType;
  description: string; // Indonesian
}

/** Tier 1 — style attributes. The primary payload. PRD §4.1. */
export interface StyleAttributes {
  topicNiche: TopicNiche;
  topicSubtopic: string; // Indonesian free text
  formatArchetype: FormatArchetype;
  hookType: HookType;
  /**
   * Domain representation: nullable. The wire representation is a required,
   * non-nullable enum with an extra `"NONE"` sentinel member — see
   * `lib/server/analysis/schema/responseSchema.ts` and TDD §4.3. The parser
   * (`lib/server/analysis/parser/validation.ts`) normalises wire `"NONE"` to
   * `null` here.
   */
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
}

/** Tier 2 — 7 dimensions, each an integer 1-5. PRD §4.5, §4.6. */
export interface Scorecard {
  hookStrength: number;
  retentionFlow: number;
  visualPolish: number; // widened: absorbs the removed audioVisualSync
  ctaEffectiveness: number; // renamed from callToAction, rescoped to execution quality only
  messageClarity: number;
  originality: number;
  emotionalResonance: number;
}

/**
 * Canonical, ordered list of `Scorecard` keys. The only literal list of
 * scorecard dimensions permitted in this module's own consumers
 * (`parser/validation.ts`) — everything that needs to iterate the 7
 * dimensions imports this rather than hand-duplicating the key list.
 */
export const SCORECARD_KEYS = [
  "hookStrength",
  "retentionFlow",
  "visualPolish",
  "ctaEffectiveness",
  "messageClarity",
  "originality",
  "emotionalResonance",
] as const satisfies readonly (keyof Scorecard)[];

export interface ContentAnalysis {
  schemaVersion: number; // PRD §4.4, stamped server-side by the parser
  style: StyleAttributes;
  overallScore: number; // 1-5
  scorecard: Scorecard;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  keyMoments: string[];
  redFlags: string[]; // renamed from patterns.recurringRedFlags
  suggestions: string[];
}

export interface AnalyzeResult {
  analysisId: string;
  content: ContentAnalysis;
  rawGemini: string;
}
