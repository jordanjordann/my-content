import type { Scorecard } from "@/lib/api/analyses/types";

/**
 * The 7 dimensions of the redesigned scorecard (PRD §4.5, TDD §3.2), in
 * display order. Replaces the deleted `audioVisualSync`/`trendAlignment`/
 * `callToAction`/`brandConsistency` set — `visualPolish` absorbs
 * `audioVisualSync`, `ctaEffectiveness` replaces `callToAction`.
 */
export const DIMENSIONS: { key: keyof Scorecard; label: string }[] = [
  { key: "hookStrength", label: "Hook Strength" },
  { key: "retentionFlow", label: "Retention Flow" },
  { key: "visualPolish", label: "Visual Polish" },
  { key: "ctaEffectiveness", label: "CTA Effectiveness" },
  { key: "messageClarity", label: "Message Clarity" },
  { key: "originality", label: "Originality" },
  { key: "emotionalResonance", label: "Emotional Resonance" },
];

export const AI_SCORE_DISCLAIMER =
  "AI Judgement — this is the model's reading of this video, not a precise measurement. Treat it as one signal, not an absolute fact.";
