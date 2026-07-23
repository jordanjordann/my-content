import { CheckIcon } from "lucide-react";

import { HOOK_TYPE_LABELS } from "@/lib/analysis/taxonomy/labels";
import type { HookCardProps } from "@/app/app/analyses/components/sections/AnalysisStyleSection/types";
import { EnumValueBadge } from "@/app/app/analyses/components/sections/AnalysisStyleSection/components/badges/EnumValueBadge";

/**
 * Primary hook type, with an optional secondary hook rendered visibly
 * subordinate — smaller, after a "+ also:" connector, not a same-size
 * second chip (design doc §2.6: this is a real primary/optional-secondary
 * relationship, unlike `ctaType[]`'s flat array).
 */
export function HookCard({ style }: HookCardProps) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Hook
        </div>
        {style.hasAudienceCallout && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="size-3" aria-hidden="true" />
            Targets a specific audience
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EnumValueBadge label={HOOK_TYPE_LABELS[style.hookType]} identifier={style.hookType} />
        {style.hookTypeSecondary && (
          <>
            <span className="text-xs text-muted-foreground">+ also:</span>
            <EnumValueBadge
              label={HOOK_TYPE_LABELS[style.hookTypeSecondary]}
              identifier={style.hookTypeSecondary}
              emphasis="muted"
            />
          </>
        )}
      </div>

      <p className="mt-3 border-l-2 pl-3 text-sm italic text-muted-foreground">
        &ldquo;{style.hookText}&rdquo;
      </p>
    </div>
  );
}
