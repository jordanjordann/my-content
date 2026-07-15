import type { Scorecard, Patterns } from "@/lib/server/analysis/types";

const SCORECARD_KEYS: (keyof Scorecard)[] = [
  "hookStrength",
  "retentionFlow",
  "visualPolish",
  "audioVisualSync",
  "trendAlignment",
  "callToAction",
  "brandConsistency",
];

export function validateScorecard(raw: unknown): Scorecard {
  if (typeof raw !== "object" || raw === null) {
    return createDefaultScorecard();
  }

  const obj = raw as Record<string, unknown>;
  const result: Partial<Scorecard> = {};

  for (const key of SCORECARD_KEYS) {
    const val = obj[key];
    result[key] = typeof val === "number" ? clampScore(val) : 5;
  }

  return result as Scorecard;
}

function createDefaultScorecard(): Scorecard {
  return {
    hookStrength: 5,
    retentionFlow: 5,
    visualPolish: 5,
    audioVisualSync: 5,
    trendAlignment: 5,
    callToAction: 5,
    brandConsistency: 5,
  };
}

export function validatePatterns(raw: unknown): Patterns {
  if (typeof raw !== "object" || raw === null) {
    return createDefaultPatterns();
  }

  const obj = raw as Record<string, unknown>;

  return {
    viralFormulas: Array.isArray(obj.viralFormulas)
      ? obj.viralFormulas.filter((v): v is string => typeof v === "string")
      : [],
    audiencePsychology: Array.isArray(obj.audiencePsychology)
      ? obj.audiencePsychology.filter((v): v is string => typeof v === "string")
      : [],
    recurringRedFlags: Array.isArray(obj.recurringRedFlags)
      ? obj.recurringRedFlags.filter((v): v is string => typeof v === "string")
      : [],
  };
}

function createDefaultPatterns(): Patterns {
  return {
    viralFormulas: [],
    audiencePsychology: [],
    recurringRedFlags: [],
  };
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}
