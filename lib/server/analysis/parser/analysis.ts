import type { ContentAnalysis } from "@/lib/server/analysis/types";
import { validateScorecard, validatePatterns } from "./validation";

export function parseContentAnalysis(text: string): ContentAnalysis {
  const json = extractJson(text);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const overallScore = typeof parsed.overallScore === "number" ? parsed.overallScore : 0;
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const perItem = Array.isArray(parsed.perItem) ? parsed.perItem : [];
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const scorecard = validateScorecard(parsed.scorecard);
  const patterns = validatePatterns(parsed.patterns);

  return {
    overallScore,
    summary,
    perItem,
    scorecard,
    patterns,
    suggestions,
  };
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
