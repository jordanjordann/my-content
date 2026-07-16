"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton placeholder while analyses are loading. */
export function AnalysisGridSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
