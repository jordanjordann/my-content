import { cn } from "@/lib/utils";
import { CTA_TYPE_LABELS } from "@/lib/analysis/taxonomy/labels";
import type { CtaCardProps } from "@/app/app/analyses/components/sections/AnalysisStyleSection/types";
import { CTA_TIMING_STEPS } from "@/app/app/analyses/components/sections/AnalysisStyleSection/constants";

/**
 * `ctaType[]` renders as equal-weight chips with no ordering implication
 * (design doc §2.5, PRD §4.4: order-insignificant array). `ctaTiming`
 * renders as a 3-step strip with the active step highlighted.
 */
export function CtaCard({ ctaType, ctaTiming }: CtaCardProps) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Call to Action
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ctaType.map((type) => (
          <span
            key={type}
            className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-foreground"
          >
            {CTA_TYPE_LABELS[type]}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">Timing</span>
        <div className="flex h-6 flex-1 overflow-hidden rounded-md border">
          {CTA_TIMING_STEPS.map((step, i) => (
            <div
              key={step.value}
              className={cn(
                "flex flex-1 items-center justify-center text-[10px]",
                i > 0 && "border-l",
                step.value === ctaTiming
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
