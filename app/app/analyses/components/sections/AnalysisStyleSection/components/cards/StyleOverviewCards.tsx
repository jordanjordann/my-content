import { FORMAT_ARCHETYPE_LABELS, TOPIC_NICHE_LABELS } from "@/lib/analysis/taxonomy/labels";
import type { StyleOverviewCardsProps } from "@/app/app/analyses/components/sections/AnalysisStyleSection/types";

/** Topic + format archetype, side by side (design doc's Direction A layout). */
export function StyleOverviewCards({ style }: StyleOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl border p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Topic
        </div>
        <div className="font-semibold">{TOPIC_NICHE_LABELS[style.topicNiche]}</div>
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">{style.topicNiche}</div>
        <div className="text-sm text-muted-foreground">{style.topicSubtopic}</div>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Format
        </div>
        <div className="font-semibold">{FORMAT_ARCHETYPE_LABELS[style.formatArchetype]}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{style.formatArchetype}</div>
      </div>
    </div>
  );
}
