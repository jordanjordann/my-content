/**
 * Ticket #71, Q3 (owner-answered 2026-07-22): matches Instagram's own
 * per-post carousel limit. Rationale: 20-slide posts are rare in practice,
 * so this cap should not bind on realistic payloads — both captured
 * fixtures are 10 slides, well under it. The truncation path this enables
 * is rarely exercised but must still be implemented and tested: parts
 * beyond the cap are dropped in document order, and the drop is declared
 * in the slide manifest (prompts/user.ts) so Gemini is told it is seeing a
 * truncated post.
 */
export const MAX_MEDIA_PARTS = 20;

const DEFAULT_MAX_TOTAL_MEDIA_BYTES = 300_000_000; // 300MB

/**
 * Aggregate ceiling across every part sent to Gemini for one analysis. With
 * `MAX_MEDIA_PARTS = 20`, this — not the part count — is the practical guard
 * for realistic payloads (Q3): a byte-heavy carousel well under 20 slides
 * can still exceed a sane total request size.
 *
 * Fix-round note (review item 8): this used to be computed once, eagerly, at
 * module-evaluation time (`export const MAX_TOTAL_MEDIA_BYTES = ...`) — an
 * invalid env var therefore threw at IMPORT time, which surfaces as a
 * `next build` failure with a stack trace pointing at this constants file
 * rather than at the request that actually needed the value. It is now a
 * function, called from `prepareParts()` itself, so the same validation
 * still fires loudly — just at call time, not at module-eval time.
 */
export function resolveMaxTotalMediaBytes(): number {
  const raw = process.env.MAX_TOTAL_MEDIA_BYTES;
  if (raw === undefined || raw === "") {
    return DEFAULT_MAX_TOTAL_MEDIA_BYTES;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid MAX_TOTAL_MEDIA_BYTES env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_MAX_TOTAL_MEDIA_BYTES} bytes) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

/**
 * Per-image ceiling (review item 3). Without this, the FIRST image of a
 * carousel is exempt from `MAX_TOTAL_MEDIA_BYTES` (see the
 * `&& geminiParts.length > 0` gating in `prepareParts.ts` — deliberate, so a
 * single huge first part can never make the request come out with ZERO
 * parts) and therefore has no ceiling at all: it could consume the entire
 * ~300MB total budget, held as a `Buffer` AND AGAIN as ~400MB of base64 text
 * in the same process. Video has no equivalent gap — it is already bounded
 * per-file by `MAX_VIDEO_BYTES`. 25MB is generous for a real Instagram
 * carousel image (these run low-single-digit MB) while still capping the
 * worst case.
 */
export const MAX_IMAGE_BYTES = 25_000_000; // 25MB
