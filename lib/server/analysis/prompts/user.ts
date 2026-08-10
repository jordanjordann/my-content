import type { MediaMetadata } from "@/lib/server/analysis/types";
import { extractNumerals, type ComputedPerformanceBlock } from "@/lib/server/analysis/prose";
import { formatAspectRatio, formatAudioLine, formatCount, formatCountID, formatPercent, formatPercentID } from "./helpers";

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

/**
 * TDD §8.1 Half A — "the highest-risk surface" (R-13.6.4): a bare,
 * unqualified percentage in Gemini's Indonesian prose escapes every UI
 * safeguard when pasted into a client deck. This block:
 *
 * 1. Labels the figure with its denominator IN WORDS (R-12.5.1) and its
 *    reach kind IN WORDS (R-4.3.1) — in Indonesian, because the label is
 *    what the model echoes.
 * 2. Supplies the figure as a single pre-formatted, already-qualified
 *    Indonesian string (`ANGKA_ENGAGEMENT`) and instructs the model to
 *    quote it VERBATIM rather than re-derive or re-format it.
 * 3. States explicitly which inputs are unavailable and forbids estimating
 *    them.
 * 4. For image-only content, states that no reach data exists and keeps
 *    every reach/views/plays token away from the engagement figure (AC-22).
 * 5. Forbids comparison against the model's own priors or another post's
 *    differently-denominated ratio (R-12.5.3).
 * 6. Forbids computing or restating any number it was not given (S2).
 *
 * `realNumerals` is derived from the SAME `angka` string the model is shown
 * (via `extractNumerals`, `lib/server/analysis/prose`), never a second,
 * independently-rounded arithmetic path — so the prompt text and the prose
 * guard's allow-list cannot drift apart (TR-1's discipline, applied here).
 *
 * Denominator preference: REACH (the displayed view/play count) when a
 * positive reach figure exists, falling back to FOLLOWERS — mirroring
 * `performance/ratios.ts`'s `computeReachEngagementRatio`/
 * `computeEngagementRate` precedence. Not wired to those primitives
 * directly: they resolve from the raw `ScrapeCreatorsMedia` payload and
 * this ticket's Files Affected list is `prompts/user.ts` only — the same
 * `MediaMetadata` fields `buildContextBlock()` above already reads.
 */
function resolvePerformanceAssessment(metadata: MediaMetadata): {
  block: string;
  computedBlock: ComputedPerformanceBlock;
} {
  const { value: displayedViewCount, isPlayCount } = resolveDisplayedViewCount(metadata);
  const likeCount = metadata.likeCount ?? null;
  const commentCount = metadata.commentCount ?? null;
  const hasEngagementCount = likeCount != null || commentCount != null;
  const engagementCount = (likeCount ?? 0) + (commentCount ?? 0);

  const unavailable: string[] = [];
  if (!hasEngagementCount) {
    unavailable.push("jumlah suka dan komentar (likes & comments)");
  }

  let angka: string | null = null;

  if (hasEngagementCount && displayedViewCount != null && displayedViewCount > 0) {
    const ratio = engagementCount / displayedViewCount;
    const denomWord = isPlayCount ? "yang menonton" : "penayangan";
    angka = `${formatPercentID(ratio)} dari ${formatCountID(displayedViewCount)} ${denomWord}`;
  } else if (hasEngagementCount && metadata.followerCount != null && metadata.followerCount > 0) {
    const ratio = engagementCount / metadata.followerCount;
    angka = `${formatPercentID(ratio)} dari jumlah pengikut (${formatCountID(metadata.followerCount)} pengikut)`;
  } else {
    unavailable.push("rasio engagement (data yang dibutuhkan untuk menghitungnya tidak lengkap)");
  }

  // AC-22: image-only content — no view/play figure exists anywhere on
  // this post. No reach/views/plays token may appear near the engagement
  // figure (there isn't one to appear near, since `angka` above only ever
  // resolves REACH-denominated when a positive view/play count exists).
  const isImageOnly = displayedViewCount == null && metadata.playCount == null;

  const lines: string[] = ["## Performance Assessment Data", ""];

  if (angka != null) {
    lines.push(`ANGKA_ENGAGEMENT = "${angka}"`);
  } else if (isImageOnly) {
    lines.push("Konten ini berupa gambar — TIDAK ADA data reach/views/plays untuk post ini.");
  } else {
    lines.push("ANGKA_ENGAGEMENT tidak tersedia untuk post ini.");
  }

  lines.push("");
  lines.push("INSTRUCTIONS (binding on your Indonesian output above):");
  if (angka != null) {
    lines.push(
      `- If you reference this post's engagement/performance figure in "verdict" or "drivers", quote ANGKA_ENGAGEMENT VERBATIM, exactly as given above. Never recompute it, reformat it, round it differently, or restate it with a different denominator.`,
    );
  }
  if (unavailable.length > 0) {
    lines.push(
      `- The following inputs are UNAVAILABLE for this post: ${unavailable.join("; ")}. Do NOT estimate, guess, or invent a number for any of them.`,
    );
  }
  lines.push(`- Never compute, derive, or restate any number you were not explicitly given above.`);
  lines.push(
    `- Never compare this post's figure against your own general knowledge/priors of "typical engagement rates", or against another post's differently-denominated ratio.`,
  );
  if (isImageOnly) {
    lines.push(
      `- This is image-only content: do not use the words "reach", "views" or "plays" anywhere near the engagement figure — no reach data exists for this post.`,
    );
  }

  return {
    block: lines.join("\n"),
    computedBlock: { realNumerals: angka != null ? extractNumerals(angka) : [] },
  };
}

/**
 * TDD §8.2's `ComputedPerformanceBlock` for THIS analysis — exported so the
 * parser stage (`lib/server/analysis/parser`) can run the prose guard
 * against exactly the figures this prompt actually supplied, derived from
 * the SAME `resolvePerformanceAssessment()` call `buildUserPrompt()` uses
 * (never a second, independent recomputation).
 */
export function computePerformanceAssessmentBlock(metadata: MediaMetadata): ComputedPerformanceBlock {
  return resolvePerformanceAssessment(metadata).computedBlock;
}

export function buildUserPrompt(metadata: MediaMetadata, userPrompt: string): string {
  const contextBlock = buildContextBlock(metadata);
  const slideManifest = buildSlideManifest(metadata);
  const performanceAssessment = resolvePerformanceAssessment(metadata).block;
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
${performanceAssessment}

---

User's specific focus: ${userPrompt}

Berikan analisis Anda dalam BAHASA INDONESIA sebagai JSON terstruktur.`;
}
