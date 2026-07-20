import type { MediaMetadata } from "@/lib/server/analysis/types";

/** Thousands-separated integer, e.g. 12345 -> "12,345". */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Fraction -> percent string, e.g. 0.0861 -> "8.61%". */
export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Pixel dimensions -> "1080x1920 (9:16 vertical)" with a label for common
 * aspect ratios; anything else is labelled "custom". Ratios are matched
 * with a small tolerance since real dimensions are rarely an exact ratio.
 */
export function formatAspectRatio(width: number, height: number): string {
  const dims = `${width}x${height}`;
  if (width <= 0 || height <= 0) {
    return dims;
  }

  const ratio = width / height;
  const isClose = (target: number, tolerance = 0.02) => Math.abs(ratio - target) <= tolerance;

  let label: string;
  if (isClose(9 / 16)) {
    label = "9:16 vertical";
  } else if (isClose(1)) {
    label = "1:1 square";
  } else if (isClose(4 / 5)) {
    label = "4:5 portrait";
  } else if (isClose(16 / 9)) {
    label = "16:9 landscape";
  } else {
    label = "custom";
  }

  return `${dims} (${label})`;
}

/**
 * Renders the audio line, distinguishing original vs. licensed/trending
 * sound — that distinction is the direct input to the trendAlignment
 * scoring dimension. Returns null when there is nothing worth saying
 * (no audio info at all).
 */
export function formatAudioLine(metadata: MediaMetadata): string | null {
  if (
    metadata.hasAudio == null &&
    !metadata.audioTitle &&
    !metadata.audioArtist &&
    metadata.audioIsOriginal == null
  ) {
    return null;
  }

  if (metadata.hasAudio === false) {
    return "No audio";
  }

  const parts: string[] = [];

  if (metadata.audioIsOriginal === true) {
    parts.push("original audio");
  } else if (metadata.audioIsOriginal === false) {
    parts.push("licensed/trending sound");
  }

  const attribution = [metadata.audioTitle, metadata.audioArtist].filter(Boolean).join(" — ");
  if (attribution) {
    parts.push(attribution);
  }

  if (parts.length === 0) {
    return "Has audio";
  }

  return parts.join(", ");
}
