/**
 * A single media part (slide) sent to Gemini for one analysis. Ticket #71:
 * every `edge_sidecar_to_children` node becomes a part in document order; a
 * non-carousel post produces a single-element array (video) or an empty
 * array (image post) — see `resolveMediaParts()`.
 */
export interface MediaPart {
  index: number;
  kind: "video" | "image";
  url: string;
  /**
   * `null` for every carousel video part — there is no duration field
   * anywhere on a carousel payload (C3/Q1=(a)). NEVER fabricated and NEVER
   * derived from `dash_info`'s DASH manifest. Populated only for a
   * non-carousel (reel/post) video, from the top-level `video_duration`.
   */
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /**
   * `video_play_count`. Q4=(c): both raw counts are persisted, never
   * collapsed at ingestion. `null` on every carousel video child (C4) — the
   * field exists on the payload but is unpopulated there.
   */
  playCount: number | null;
  /**
   * `video_view_count`. Q4=(c): the display/ranking metric, consistently,
   * across reels and carousel slides. Can be a misleading `0` on a reel
   * alongside a populated `playCount` (C4) — see `displayedCountIsPlayCount`.
   */
  viewCount: number | null;
  /**
   * `true` when `viewCount` is a known-bad `0` and display fell back to
   * `playCount` instead — set so the mixed case is visible, not silent
   * (Q4). Always `false` when there was nothing to fall back to (e.g. every
   * carousel video child, where `playCount` is always `null`).
   */
  displayedCountIsPlayCount: boolean;
}

/** Result of enumerating + capping a post's media parts. */
export interface ResolvedMediaParts {
  parts: MediaPart[];
  /** Total part count BEFORE the `MAX_MEDIA_PARTS` cap was applied. */
  totalPartsBeforeCap: number;
  /** `true` iff `totalPartsBeforeCap > MAX_MEDIA_PARTS` — parts were dropped. */
  truncated: boolean;
}

/** A single Gemini request part after download/inline-encoding (`prepareParts()`). */
export type PreparedGeminiPart =
  | { fileData: { fileUri: string; mimeType: string } }
  | { inlineData: { mimeType: string; data: string } };

export interface PreparedParts {
  geminiParts: PreparedGeminiPart[];
  /** Every temp file written to disk during preparation — videos only. */
  tempFilePaths: string[];
  /** `true` iff one or more trailing parts were dropped by `MAX_TOTAL_MEDIA_BYTES`. */
  truncatedForBytes: boolean;
  /** Number of parts actually prepared (<= input parts.length). */
  preparedCount: number;
  /**
   * Gemini File API upload results for every video part actually uploaded,
   * in slide order. The `analyses` table has a single `gemini_file_uri`/
   * `gemini_file_expires_at` column pair (unchanged by ticket #71) — the
   * pipeline persists the FIRST entry here, mirroring `videoUrl`'s
   * "first video part" convention.
   */
  videoFileUris: { uri: string; expiresAt: string }[];
}
