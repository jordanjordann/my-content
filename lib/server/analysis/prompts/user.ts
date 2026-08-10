import type { MediaMetadata } from "@/lib/server/analysis/types";
import { formatAspectRatio, formatAudioLine, formatCount, formatPercent } from "./helpers";

const CONTEXT_FRAMING_NOTE = `CATATAN: Angka-angka di atas adalah KONTEKS pendukung, bukan bukti kualitas.
Dasarkan penilaian Anda terutama pada isi video yang Anda tonton.
Gunakan metrik hanya untuk mengkalibrasi seberapa baik konten ini
berkinerja relatif terhadap ukuran audiens kreator.`;

/**
 * Q4=(c): display and rank on VIEWS, consistently, across reels and
 * carousel slides. `metadata.viewCount` is stored RAW (video_view_count,
 * even when it's a known-bad `0` or absent) so the two raw metrics stay
 * queryable and `analyses.view_count`'s meaning never changes — this is the
 * presentation-layer fallback: a reel with a known-bad `viewCount: 0` (or an
 * ABSENT `viewCount`, widened by D1/#110) alongside a populated `playCount`
 * displays the play count instead, and `isPlayCount` records that a plays
 * number is what's shown. `likeAndViewCountsDisabled` is checked FIRST,
 * mirroring the client classifier's documented branch order
 * (`lib/api/analyses/helpers.ts`'s `classifyViewCount`, #101) — a
 * counts-disabled post never falls through to the plays fallback, even
 * though the adapter already nulls `viewCount`/`displayedCountIsPlayCount`
 * one layer down (belt-and-suspenders parity, PR #111 review N3).
 *
 * PR #111 review N4: this is the SINGLE SOURCE OF TRUTH for the
 * value/label pairing — both call sites below (`buildContextBlock`,
 * `buildUserPrompt`) MUST consume `isPlayCount` from this return value,
 * never re-derive `displayedCountIsPlayCount && playCount != null`
 * themselves. Re-deriving it at each site is how the "silently emit a play
 * count labelled Views" bug this PR fixes would come back.
 */
function resolveDisplayedViewCount(metadata: MediaMetadata): { value: number | null; isPlayCount: boolean } {
  if (metadata.likeAndViewCountsDisabled === true) {
    return { value: null, isPlayCount: false };
  }
  if (metadata.displayedCountIsPlayCount && metadata.playCount != null) {
    return { value: metadata.playCount, isPlayCount: true };
  }
  return { value: metadata.viewCount, isPlayCount: false };
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

  // TR-4 (docs/TDD-3A-3B-3C-phase-3.md §0.7a, #182): the header states NO
  // total. `formatMediaType()` already renders the prompt's ONE canonical
  // slide total (`carousel (${carouselItemCount} slides)`, itself
  // `getCarouselEdges(raw).length` under TR-1) one block higher in
  // `buildUserPrompt()`. A second total here, computed off a different
  // population (`parts.length`, post-filter/post-cap), was a second
  // expression rendering the same quantity into the same prompt — the
  // exact failure class TR-1 abolished for indices and counts. Ordering is
  // already carried by the numbered list; coverage is already carried by
  // the `Type:` line. Deleted, not renamed, not re-derived.
  //
  // The incomplete-list note's gate is widened from `mediaPartsTruncated`
  // alone to "the listed slides are not all the slides" — one predicate
  // covering the `MAX_MEDIA_PARTS` cap, the byte cap (`truncatedForBytes`,
  // reconciled back onto `mediaPartsTruncated` upstream) AND the null-node
  // gap (a carousel with a null `edge.node` produces fewer real parts than
  // `carouselItemCount` without `mediaPartsTruncated` ever being set).
  // `mediaPartsTruncated === true` is kept as the defensive fallback for
  // the (unreachable in practice) `carouselItemCount == null` case. The
  // wording names no figure — every rendered slide number is a true slide
  // position; the gap itself is deliberately not explained (TR-4).
  const listIsIncomplete =
    metadata.mediaPartsTruncated === true ||
    (metadata.carouselItemCount != null && parts.length < metadata.carouselItemCount);

  const incompleteListNote = listIsIncomplete
    ? "\n\n(NOTE: not every slide of this carousel is listed above — some were not sent to you. Base your analysis only on the slides shown.)"
    : "";

  return `## Slides (in order)\n\n${lines.join("\n")}${incompleteListNote}\n\nThis is ONE post — give a single holistic verdict over all slides, not a per-slide verdict.`;
}

/**
 * Renders the "## Engagement & Technical Context" section. Only emits lines
 * for values that are present — no "N/A" spam — and returns null (omitting
 * the whole block, including the header) if every value is null.
 */
function buildContextBlock(metadata: MediaMetadata): string | null {
  const lines: string[] = [];
  const { value: displayedViewCount, isPlayCount } = resolveDisplayedViewCount(metadata);

  if (displayedViewCount != null) {
    lines.push(`- ${isPlayCount ? "Plays" : "Views"}: ${formatCount(displayedViewCount)}`);
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

  if (
    metadata.mediaType === "reel" &&
    displayedViewCount != null &&
    metadata.followerCount != null &&
    metadata.followerCount > 0
  ) {
    // D1: labelled by what the numerator actually is (plays vs. views),
    // same isPlayCount condition as the count line above — the value never
    // changes, only the label.
    lines.push(
      `- ${isPlayCount ? "Play rate" : "View rate"}: ${formatPercent(displayedViewCount / metadata.followerCount)}`,
    );
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
  const { value: displayedViewCount, isPlayCount } = resolveDisplayedViewCount(metadata);

  return `Analyze the following content:

- URL: ${metadata.url}
- Type: ${formatMediaType(metadata)}
- Username: ${metadata.username}
- ${isPlayCount ? "Plays" : "Views"}: ${displayedViewCount ?? "N/A"}
- Duration: ${metadata.durationSec ? `${metadata.durationSec}s` : "N/A"}
- Post Date: ${metadata.postDate ?? "N/A"}
- Caption: ${metadata.caption ?? "N/A"}
${contextBlock ? `\n${contextBlock}\n` : ""}${slideManifest ? `\n${slideManifest}\n` : ""}
---

User's specific focus: ${userPrompt}

Berikan analisis Anda dalam BAHASA INDONESIA sebagai JSON terstruktur.`;
}
