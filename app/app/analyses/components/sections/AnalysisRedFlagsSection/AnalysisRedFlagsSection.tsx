"use client";

import type { RedFlagsSectionProps } from "@/app/app/analyses/components/sections/types";
import { PatternBlock } from "../PatternBlock";

/**
 * Renders `redFlags` — labelled "Red Flags", not "Recurring Red Flags"
 * (TDD §8.2, PRD §2): Gemini saw exactly one video and nothing else, so the
 * output is neither recurring nor comparative. `viralFormulas` and
 * `audiencePsychology` (formerly rendered here as `AnalysisPatternsSection`)
 * no longer exist on the contract — they decompose into Tier 1 style
 * attributes, rendered by `AnalysisStyleSection` instead.
 */
export function AnalysisRedFlagsSection({ results }: RedFlagsSectionProps) {
  const { redFlags } = results;

  if (redFlags.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Findings from this video only — not a recurring pattern.
      </p>

      <PatternBlock title="Red Flags" items={redFlags} variant="danger" />
    </div>
  );
}
