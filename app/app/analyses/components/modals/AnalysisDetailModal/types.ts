export interface AnalysisDetailModalProps {
  id: string
  onClose: () => void
}

/**
 * Direction A tabbed modal (design doc §1). "Gaya" (style) is the default
 * landing tab — style is the primary purpose of analysis output, scoring
 * is secondary (PRD §13).
 */
export type AnalysisDetailTab = "style" | "score" | "notes"

export interface AnalysisDetailTabListProps {
  activeTab: AnalysisDetailTab
  onTabChange: (tab: AnalysisDetailTab) => void
}
