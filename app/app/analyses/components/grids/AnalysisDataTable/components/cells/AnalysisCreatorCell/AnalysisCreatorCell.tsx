import { Camera, PlaySquare } from "lucide-react";

import type { AnalysisCreatorCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCreatorCell/types";
import type { AnalysisPlatform } from "@/lib/api/analyses/types";

/**
 * Ticket #149 / DESIGN-3C §2.2 col 2 — `@username` + platform glyph + word (Comfortable only).
 * Extracted from the inline markup #145 shipped as a placeholder for this ticket's real layout.
 * No new colour-only distinction: the glyph is always paired with the platform word in text
 * (WCAG 1.4.1) and is `aria-hidden` (the word carries the accessible information).
 *
 * No creator-profile route exists in this codebase today (verified — no `/app/creator` or
 * similar page). Rather than guess a destination, this renders plain text; DESIGN-3C §8's
 * "creator link" exemption is left for a future ticket that actually ships a destination,
 * flagged in the PR body.
 */
export function AnalysisCreatorCell({ username, platform, comfortable }: AnalysisCreatorCellProps) {
  // lucide-react ships no platform-brand icons in this version — `Camera`/`PlaySquare` are
  // generic stand-ins, always paired with the platform WORD below (WCAG 1.4.1: the glyph is
  // `aria-hidden` decoration, never the only channel).
  const Icon = platform === "youtube" ? PlaySquare : Camera;

  return (
    <div>
      <p className="truncate text-sm">@{username}</p>
      {comfortable && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon className="size-3" aria-hidden="true" />
          {platformWord(platform)}
        </p>
      )}
    </div>
  );
}

function platformWord(platform: AnalysisPlatform): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
}
