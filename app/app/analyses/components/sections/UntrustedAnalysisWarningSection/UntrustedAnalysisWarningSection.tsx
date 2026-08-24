import { AlertTriangleIcon } from "lucide-react";

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
 * immediately on mount, not just on visual scan; the icon is `aria-hidden` since the message
 * text alone already carries the full meaning (colour/icon is never the only signal).
 */
export function UntrustedAnalysisWarningSection() {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
    >
      <AlertTriangleIcon
        className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Video could not be downloaded — analysis may be unreliable</p>
        <p className="leading-relaxed text-amber-900/90 dark:text-amber-200/90">
          This video could not be downloaded, so the analysis was produced from the title and
          caption only. Anything below that describes the visuals, editing or on-screen moments
          is not reliable and should not be trusted.
        </p>
      </div>
    </div>
  );
}
