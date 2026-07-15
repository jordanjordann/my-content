"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisCard } from "../cards/AnalysisCard";
import type { AnalysisGridProps } from "@/app/analyses/types";

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

export function AnalysisGridSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
