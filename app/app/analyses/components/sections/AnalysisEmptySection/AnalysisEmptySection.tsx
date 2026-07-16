"use client";

import { BarChart3, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AnalysisEmptyProps } from "@/app/app/analyses/types";

const VARIANTS = {
  no_data: {
    Icon: BarChart3,
    title: "No analyses yet",
    body: "Paste some URLs and get AI-powered insights on your content.",
  },
  no_matches: {
    Icon: SearchX,
    title: "No matching results",
    body: "Try adjusting your filters or clear them to see all analyses.",
  },
} as const;

/** Empty state shown when no analyses exist or no filters match, with context-aware text and CTA. */
export function AnalysisEmptySection({
  context,
  onNewAnalysis,
  onClearFilters,
}: AnalysisEmptyProps) {
  const { Icon, title, body } = VARIANTS[context];

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Icon className="mb-4 h-16 w-16 text-muted-foreground/50" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        {body}
      </p>
      {context === "no_data" && onNewAnalysis && (
        <Button onClick={onNewAnalysis}>New Analysis</Button>
      )}
      {context === "no_matches" && onClearFilters && (
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
