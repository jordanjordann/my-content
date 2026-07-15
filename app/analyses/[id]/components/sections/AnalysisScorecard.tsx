"use client";

import type { ScorecardSectionProps } from "@/app/analyses/[id]/types";

const DIMENSIONS: { key: keyof import("@/lib/api/analyses/types").Scorecard; label: string }[] = [
  { key: "hookStrength", label: "Hook Strength" },
  { key: "retentionFlow", label: "Retention Flow" },
  { key: "visualPolish", label: "Visual Polish" },
  { key: "audioVisualSync", label: "Audio-Visual Sync" },
  { key: "trendAlignment", label: "Trend Alignment" },
  { key: "callToAction", label: "Call to Action" },
  { key: "brandConsistency", label: "Brand Consistency" },
];

/** Radial score display with per-dimension breakdown. */
export function AnalysisScorecard({ results }: ScorecardSectionProps) {
  const { overallScore, scorecard, summary } = results;
  const scoreColor = getScoreColor(overallScore);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(overallScore / 10) * 327} 327`}
              className={scoreColor}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-3xl font-bold ${scoreColor}`}>{overallScore}</span>
            <span className="text-xs text-muted-foreground">/ 10</span>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">{summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DIMENSIONS.map(({ key, label }) => {
          const score = scorecard[key];
          return (
            <div
              key={key}
              className="flex flex-col items-center gap-1 rounded-lg border p-3"
            >
              <div className="relative flex h-16 w-16 items-center justify-center">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    className="text-muted/20"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 10) * 163} 163`}
                    className={getScoreColor(score)}
                  />
                </svg>
                <span className={`absolute text-sm font-semibold ${getScoreColor(score)}`}>
                  {score}
                </span>
              </div>
              <span className="text-center text-xs text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 7) return "text-green-500";
  if (score >= 5) return "text-yellow-500";
  return "text-red-500";
}
