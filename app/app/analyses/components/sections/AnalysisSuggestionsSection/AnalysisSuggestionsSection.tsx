"use client";

import type { SuggestionsSectionProps } from "@/app/app/analyses/components/sections/types";

/** List of actionable suggestions for content improvement. */
export function AnalysisSuggestionsSection({ results }: SuggestionsSectionProps) {
  const { suggestions } = results;

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Suggestions</h2>

      <ol className="flex flex-col gap-3">
        {suggestions.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {i + 1}
            </span>
            <span className="text-sm">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
