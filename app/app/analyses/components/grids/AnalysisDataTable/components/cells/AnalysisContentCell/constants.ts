import type { AnalysisListItemIndexed, AnalysisMode } from "@/lib/api/analyses/types";

/**
 * The thumbnail-overlay kind label (DESIGN-3C §2.1/§2.2 col 1: "kind + slide-count overlay").
 * The slide-COUNT half of that overlay is NOT rendered — `AnalysisListItem` (the #144 API
 * response, `lib/api/analyses/types.ts`) carries no slide/media-part-count field, and inventing
 * one would be a fabricated number (AGENTS.md external-verification rule / R-13.5.3a). Flagged
 * in the PR body rather than guessed; the kind word alone is still real, verified data.
 */
export const CONTENT_KIND_LABELS: Record<AnalysisListItemIndexed["mediaType"], string> = {
  reel: "Reel",
  post: "Post",
  carousel: "Carousel",
  short: "Short",
};

/** AC-13 — the labelled mode chip, shown only when the mode is not `full_video` (DESIGN-3C §2.1). */
export const MODE_CHIP_LABELS: Partial<Record<AnalysisMode, string>> = {
  metadata_only: "Caption only",
  images_only: "Images only",
};
