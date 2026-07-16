"use client";

import type { PatternsSectionProps } from "@/app/app/analyses/components/sections/types";
import { PatternBlock } from "../PatternBlock";

/** Displays viral formulas, audience psychology, and recurring red flags. */
export function AnalysisPatternsSection({ results }: PatternsSectionProps) {
  const { patterns } = results;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Patterns</h2>

      <PatternBlock
        title="Viral Formulas"
        items={patterns.viralFormulas}
        variant="default"
      />

      <PatternBlock
        title="Audience Psychology"
        items={patterns.audiencePsychology}
        variant="default"
      />

      <PatternBlock
        title="Recurring Red Flags"
        items={patterns.recurringRedFlags}
        variant="danger"
      />
    </div>
  );
}
