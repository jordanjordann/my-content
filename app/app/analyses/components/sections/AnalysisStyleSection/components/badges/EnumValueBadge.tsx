import { cn } from "@/lib/utils";
import type { EnumValueBadgeProps } from "@/app/app/analyses/components/sections/AnalysisStyleSection/types";

/**
 * Bilingual enum rendering (design doc §2.4): the Indonesian label is the
 * primary, bold text; the English machine identifier is always visible
 * beneath it in small muted monospace — not hover-only, since the
 * identifier is used for cross-referencing exports and talking to
 * engineering about a specific taxonomy value.
 */
export function EnumValueBadge({ label, identifier, emphasis = "primary" }: EnumValueBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-col gap-0.5 rounded-lg px-3 py-1.5",
        emphasis === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{identifier}</span>
    </span>
  );
}
