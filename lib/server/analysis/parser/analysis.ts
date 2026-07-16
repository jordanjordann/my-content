import type { ContentAnalysis } from "@/lib/server/analysis/types";
import { validateScorecard, validatePatterns } from "./validation";

export function parseContentAnalysis(text: string): ContentAnalysis {
  const json = extractJson(text);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const overallScore = typeof parsed.overallScore === "number" ? parsed.overallScore : 0;
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const strengths = validateStringArray(parsed.strengths);
  const weaknesses = validateStringArray(parsed.weaknesses);
  const keyMoments = validateStringArray(parsed.keyMoments);
  const suggestions = validateStringArray(parsed.suggestions);
  const scorecard = validateScorecard(parsed.scorecard);
  const patterns = validatePatterns(parsed.patterns);

  return {
    overallScore,
    summary,
    strengths,
    weaknesses,
    keyMoments,
    scorecard,
    patterns,
    suggestions,
  };
}

function validateStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("No valid JSON found in response");
}
