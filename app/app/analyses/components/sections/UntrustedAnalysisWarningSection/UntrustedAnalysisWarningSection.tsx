import { AlertCircle } from "lucide-react";

import {
  UNTRUSTED_ANALYSIS_WARNING_BODY,
  UNTRUSTED_ANALYSIS_WARNING_TITLE,
} from "./constants";

/**
 * Ticket #294 (parent #288) — the detail modal's untrusted-analysis banner.
 *
 * `yt-dlp` is bot-blocked from the production server, so some stored YouTube analyses were
 * produced with the video never downloaded: Gemini ran on the title/caption alone and its
 * output can describe timestamps, editing and visuals that are not in the video. The existing
 * `Caption only` table chip (`AnalysisContentCell`) is not enough warning for content that may
 * be fabricated, so this renders a second, visually distinct, always-on-top banner inside the
 * detail modal.
 *
 * Mounted only when the caller's `isUntrustedYoutubeMetadataOnly` flag is `true` — this
 * component takes no props and never re-evaluates that condition itself (AGENTS.md: derive in
 * the query hook, not the component). `role="alert"` so assistive tech announces it
 * immediately on mount, not just on visual scan (covered by
 * `UntrustedAnalysisWarningSection.dom.test.tsx`); the icon is `aria-hidden` since the message
 * text alone already carries the full meaning (colour/icon is never the only signal).
 *
 * Uses the `accent` semantic token (`app/globals.css`) rather than the raw Tailwind `amber-*`
 * palette — `tests/helpers/contrast.ts`'s ratio suite (`contrast.dom.test.tsx`) already measures
 * `accent` against all four app surfaces, so this banner's contrast is actually verified, not
 * just eyeballed. Vertical spacing is owned entirely by the caller (`AnalysisDetailModal`'s
 * wrapper `div`) — this component contributes no external margin of its own.
 */
export function UntrustedAnalysisWarningSection() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-foreground"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{UNTRUSTED_ANALYSIS_WARNING_TITLE}</p>
        <p className="leading-relaxed text-muted-foreground">{UNTRUSTED_ANALYSIS_WARNING_BODY}</p>
      </div>
    </div>
  );
}
