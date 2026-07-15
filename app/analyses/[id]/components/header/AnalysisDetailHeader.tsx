"use client";

import { ArrowLeft, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnalysisDetailHeaderProps } from "@/app/analyses/[id]/types";

/** Header for the analysis detail page showing metadata, status, and back navigation. */
export function AnalysisDetailHeader({ analysis, onBack }: AnalysisDetailHeaderProps) {
  const dateStr = formatDate(analysis.createdAt);

  const statusColor =
    analysis.status === "completed"
      ? "bg-green-500/10 text-green-600 dark:text-green-400"
      : analysis.status === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";

  const platforms = extractPlatforms(analysis.items);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{analysis.prompt || "No prompt"}</h1>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateStr}
            </span>

            <Badge variant="secondary" className={`rounded-full ${statusColor}`}>
              {analysis.status}
            </Badge>

            <span>{analysis.items.length} item{analysis.items.length !== 1 ? "s" : ""}</span>

            {platforms.map((p) => (
              <Badge key={p} variant="secondary" className="capitalize">
                {p === "youtube" ? "YT" : "IG"}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractPlatforms(items: { platform: string }[]): string[] {
  const set = new Set(items.map((i) => i.platform));
  return Array.from(set);
}
