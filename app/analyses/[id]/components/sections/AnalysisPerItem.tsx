"use client";

import { Check, X, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { PerItemSectionProps } from "@/app/analyses/[id]/types";

export function AnalysisPerItem({ items, results }: PerItemSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Per-Item Breakdown</h2>

      {results.perItem.map((item, i) => {
        const contentItem = items[i];
        const scoreColor = getScoreColor(item.score);

        return (
          <div key={i}>
            {i > 0 && <Separator className="mb-4" />}

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${getScoreBg(item.score)} ${scoreColor}`}>
                  {item.score}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{contentItem?.username ?? "Unknown"}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="capitalize">
                      {item.mediaType}
                    </Badge>
                    <span className="truncate">{contentItem?.url}</span>
                  </div>
                </div>
              </div>

              {item.strengths.length > 0 && (
                <div className="ml-13 flex flex-col gap-1">
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Strengths
                  </span>
                  {item.strengths.map((s, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {item.weaknesses.length > 0 && (
                <div className="ml-13 flex flex-col gap-1">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    Weaknesses
                  </span>
                  {item.weaknesses.map((w, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {item.keyMoments.length > 0 && (
                <div className="ml-13 flex flex-col gap-1">
                  <span className="text-xs font-medium">Key Moments</span>
                  {item.keyMoments.map((m, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 7) return "text-green-500";
  if (score >= 5) return "text-yellow-500";
  return "text-red-500";
}

function getScoreBg(score: number): string {
  if (score >= 7) return "bg-green-500/10";
  if (score >= 5) return "bg-yellow-500/10";
  return "bg-red-500/10";
}
