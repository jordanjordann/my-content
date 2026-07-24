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
 */
function resolveMaxTotalMediaBytes(): number {
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

export const MAX_TOTAL_MEDIA_BYTES = resolveMaxTotalMediaBytes();
