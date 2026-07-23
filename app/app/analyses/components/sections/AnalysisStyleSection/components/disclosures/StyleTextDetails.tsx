import type { StyleTextDetailsProps } from "@/app/app/analyses/components/sections/AnalysisStyleSection/types";

/**
 * On-screen text, verbal tone tags, and caption style notes, collapsed
 * under a `<details>` disclosure (design doc: mockup's "Detail teks & nada
 * bicara" block) — secondary detail, not needed for a first scan of the tab.
 * Fields nullable/empty per style §3 gap notes are omitted cleanly rather
 * than shown as an empty state.
 */
export function StyleTextDetails({
  onScreenText,
  verbalTonePatterns,
  captionStyleNotes,
}: StyleTextDetailsProps) {
  const hasOnScreenText = onScreenText.length > 0;
  const hasTonePatterns = verbalTonePatterns.length > 0;
  const hasCaptionNotes = captionStyleNotes.trim().length > 0;

  if (!hasOnScreenText && !hasTonePatterns && !hasCaptionNotes) return null;

  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-wide text-muted-foreground">
        On-screen text &amp; verbal tone
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        {hasOnScreenText && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">On-screen text</div>
            <div className="flex flex-wrap gap-1.5">
              {onScreenText.map((text, i) => (
                <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs">
                  &ldquo;{text}&rdquo;
                </span>
              ))}
            </div>
          </div>
        )}
        {hasTonePatterns && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Verbal tone patterns</div>
            <div className="flex flex-wrap gap-1.5">
              {verbalTonePatterns.map((tag, i) => (
                <span key={i} className="rounded-full border px-2 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {hasCaptionNotes && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Caption style</div>
            <p className="text-muted-foreground">{captionStyleNotes}</p>
          </div>
        )}
      </div>
    </details>
  );
}
