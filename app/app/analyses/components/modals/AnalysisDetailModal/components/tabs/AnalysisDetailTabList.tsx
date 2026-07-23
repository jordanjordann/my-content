"use client";

import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import type {
  AnalysisDetailTab,
  AnalysisDetailTabListProps,
} from "@/app/app/analyses/components/modals/AnalysisDetailModal/types";

const TABS: { id: AnalysisDetailTab; label: string }[] = [
  { id: "style", label: "Gaya" },
  { id: "score", label: "Skor AI" },
  { id: "notes", label: "Catatan" },
];

/**
 * Proper ARIA tab pattern (design doc §4): `role="tablist"`/`role="tab"`,
 * `aria-selected`, and left/right arrow-key navigation between tabs.
 */
export function AnalysisDetailTabList({ activeTab, onTabChange }: AnalysisDetailTabListProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const nextIndex =
      e.key === "ArrowRight" ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length;
    onTabChange(TABS[nextIndex].id);
    (
      document.getElementById(`analysis-detail-tab-${TABS[nextIndex].id}`) as HTMLElement | null
    )?.focus();
  };

  return (
    <div role="tablist" aria-label="Analysis detail sections" className="flex items-center gap-1 border-b px-6 pt-4">
      {TABS.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`analysis-detail-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`analysis-detail-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
