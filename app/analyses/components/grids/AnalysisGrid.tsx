"use client";

import { AnalysisCard } from "../cards/AnalysisCard";
import type { AnalysisGridProps } from "@/app/analyses/types";

/** Renders a vertical list of analysis cards. */
export function AnalysisGrid({
  analyses,
  onAnalysisClick,
  onDelete,
  isDeleting,
}: AnalysisGridProps) {
  return (
    <div className="flex flex-col gap-3">
      {analyses.map((analysis) => (
        <AnalysisCard
          key={analysis.id}
          analysis={analysis}
          onClick={onAnalysisClick}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
      ))}
    </div>
  );
}
