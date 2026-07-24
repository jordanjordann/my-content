import type { MediaMetadata } from "@/lib/server/analysis/types";
import { formatAspectRatio, formatAudioLine, formatCount, formatPercent } from "./helpers";

const CONTEXT_FRAMING_NOTE = `CATATAN: Angka-angka di atas adalah KONTEKS pendukung, bukan bukti kualitas.
Dasarkan penilaian Anda terutama pada isi video yang Anda tonton.
Gunakan metrik hanya untuk mengkalibrasi seberapa baik konten ini
berkinerja relatif terhadap ukuran audiens kreator.`;

/**
 * Q4=(c): display and rank on VIEWS, consistently, across reels and
 * carousel slides. `metadata.viewCount` is stored RAW (video_view_count,
 * even when it's a known-bad `0`) so the two raw metrics stay queryable and
 * `analyses.view_count`'s meaning never changes — this is the presentation-
 * layer fallback: a reel with a known-bad `viewCount: 0` alongside a
 * populated `playCount` displays the play count instead, and
 * `displayedCountIsPlayCount` records that a plays number is what's shown.
 */
function resolveDisplayedViewCount(metadata: MediaMetadata): number | null {
  if (metadata.displayedCountIsPlayCount && metadata.playCount != null) {
    return metadata.playCount;
  }
  return metadata.viewCount;
}

function formatMediaType(metadata: MediaMetadata): string {
  if (metadata.mediaType === "carousel" && metadata.carouselItemCount != null) {
    return `carousel (${metadata.carouselItemCount} slides)`;
  }
  return metadata.mediaType;
}

/**
 * Ticket #71 Step 6: emits a slide manifest for a multi-part post so Gemini
 * can address slides by number and knows it is looking at ONE holistic post,
 * not a series of independent items — a carousel gets one verdict over all
 * slides, never a per-slide verdict. Duration is unavailable per-slide for a
 * carousel (C3): a video slide is rendered as `video`, with NO `(0s)` — that
 * would tell Gemini something false. Returns null when there is nothing to
 * enumerate (a single reel/post already gets its own "Type"/"Duration" line
 * above, or an image-only post with no media parts at all).
 */
function buildSlideManifest(metadata: MediaMetadata): string | null {
  const parts = metadata.mediaParts ?? [];
  if (parts.length < 2) {
    return null;
  }

  const lines = parts.map((part) => {
    const label = part.kind === "video" && part.durationSec != null ? `video (${part.durationSec}s)` : part.kind;
    return `${part.index + 1}. ${label}`;
  });

  const truncationNote = metadata.mediaPartsTruncated
    ? "\n\n(NOTE: this carousel has MORE slides than are listed above — it was truncated before being sent to you. Base your analysis only on the slides shown.)"
    : "";

  return `## Slides (${parts.length} total, in order)\n\n${lines.join("\n")}${truncationNote}\n\nThis is ONE post — give a single holistic verdict over all slides, not a per-slide verdict.`;
}

/**
 * Renders the "## Engagement & Technical Context" section. Only emits lines
 * for values that are present — no "N/A" spam — and returns null (omitting
 * the whole block, including the header) if every value is null.
 */
function buildContextBlock(metadata: MediaMetadata): string | null {
  const lines: string[] = [];
  const displayedViewCount = resolveDisplayedViewCount(metadata);

  if (displayedViewCount != null) {
    lines.push(`- Views: ${formatCount(displayedViewCount)}`);
  }

  if (metadata.likeCount != null) {
    lines.push(`- Likes: ${formatCount(metadata.likeCount)}`);
  }

  if (metadata.commentCount != null) {
    lines.push(`- Comments: ${formatCount(metadata.commentCount)}`);
  }

  if (metadata.followerCount != null) {
    lines.push(`- Creator followers: ${formatCount(metadata.followerCount)}`);
  }

  if (metadata.engagementRate != null) {
    lines.push(`- Engagement rate: ${formatPercent(metadata.engagementRate)}`);
  }

  if (
    metadata.mediaType === "reel" &&
    displayedViewCount != null &&
    metadata.followerCount != null &&
    metadata.followerCount > 0
  ) {
    lines.push(`- View rate: ${formatPercent(displayedViewCount / metadata.followerCount)}`);
  }

  const audioLine = formatAudioLine(metadata);
  if (audioLine) {
    lines.push(`- Audio: ${audioLine}`);
  }

  if (metadata.originalWidth != null && metadata.originalHeight != null) {
    lines.push(`- Resolution: ${formatAspectRatio(metadata.originalWidth, metadata.originalHeight)}`);
  }

  if (lines.length === 0) {
    return null;
  }

  return `## Engagement & Technical Context\n\n${lines.join("\n")}\n\n${CONTEXT_FRAMING_NOTE}`;
}

export function buildUserPrompt(metadata: MediaMetadata, userPrompt: string): string {
  const contextBlock = buildContextBlock(metadata);
  const slideManifest = buildSlideManifest(metadata);
  const displayedViewCount = resolveDisplayedViewCount(metadata);

  return `Analyze the following content:

- URL: ${metadata.url}
- Type: ${formatMediaType(metadata)}
- Username: ${metadata.username}
- Views: ${displayedViewCount ?? "N/A"}
- Duration: ${metadata.durationSec ? `${metadata.durationSec}s` : "N/A"}
- Post Date: ${metadata.postDate ?? "N/A"}
- Caption: ${metadata.caption ?? "N/A"}
${contextBlock ? `\n${contextBlock}\n` : ""}${slideManifest ? `\n${slideManifest}\n` : ""}
---

User's specific focus: ${userPrompt}

Berikan analisis Anda dalam BAHASA INDONESIA sebagai JSON terstruktur.`;
}
