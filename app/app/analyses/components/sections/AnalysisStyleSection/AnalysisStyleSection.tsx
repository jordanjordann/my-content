import type { StyleSectionProps } from "@/app/app/analyses/components/sections/types";
import { StyleOverviewCards } from "./components/cards/StyleOverviewCards";
import { HookCard } from "./components/cards/HookCard";
import { CtaCard } from "./components/cards/CtaCard";
import { StructureBeatTimeline } from "./components/timelines/StructureBeatTimeline";
import { StyleTextDetails } from "./components/disclosures/StyleTextDetails";

/**
 * Tier 1 style attributes — the primary payload of the analysis (PRD §3,
 * §13; design doc §2.9: style leads, placed above the scorecard within the
 * "Gaya" tab). There is no approved design for this surface's presentation
 * beyond the tabbed shell and the sub-decisions in the design doc — this is
 * the straightforward labelled-attribute-list-plus-timeline build the
 * ticket calls for so the data ships correctly, not a from-scratch design
 * pass (TDD §8.2 "Design gap").
 */
export function AnalysisStyleSection({ results }: StyleSectionProps) {
  const { style } = results;

  return (
    <div className="flex flex-col gap-4">
      <StyleOverviewCards style={style} />
      <HookCard style={style} />
      <CtaCard ctaType={style.ctaType} ctaTiming={style.ctaTiming} />
      <StructureBeatTimeline
        beats={style.structureBeatMap}
        pacing={style.pacing}
        estimatedCutsPerMinute={style.estimatedCutsPerMinute}
      />
      <StyleTextDetails
        onScreenText={style.onScreenText}
        verbalTonePatterns={style.verbalTonePatterns}
        captionStyleNotes={style.captionStyleNotes}
      />
    </div>
  );
}
