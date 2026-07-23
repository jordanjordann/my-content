import { PACING_LABELS } from "@/lib/analysis/taxonomy/labels";
import type { Pacing } from "@/lib/api/analyses/types";

/** `mm:ss` timestamp for a beat-map point, e.g. `65` -> `"1:05"`. */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** `"Fast · ~22 cuts/min"` — pulls in `pacing` and `estimatedCutsPerMinute` (design doc §2.8). */
export function formatTempoReadout(pacing: Pacing, estimatedCutsPerMinute: number | null): string {
  const label = PACING_LABELS[pacing];
  if (estimatedCutsPerMinute == null) return label;
  return `${label} · ~${estimatedCutsPerMinute} cuts/min`;
}
