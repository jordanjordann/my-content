import type { ScrapeCreatorsCarouselChildNode, ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import { MAX_MEDIA_PARTS } from "./constants";
import type { MediaPart, ResolvedMediaParts } from "./types";

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return null;
}

/**
 * Reads the raw play/view counts off a single media node (either the
 * top-level `ScrapeCreatorsMedia` for a reel/post, or a carousel child) and
 * resolves the display fallback (Q4). Both field names (`video_play_count`,
 * `video_view_count`) are identical across the two node shapes — the C4
 * "branch on media type, not a shared resolver" requirement is satisfied by
 * WHICH object this is called with (the top-level media for a non-carousel
 * post, a specific child node for a carousel slide), never by guessing a
 * field name. See fetcher/adapter.ts and resolveMediaParts() below for the
 * two call sites, and the fixture-pinned tests for one assertion per branch.
 */
function resolveCounts(node: ScrapeCreatorsMedia | ScrapeCreatorsCarouselChildNode): {
  playCount: number | null;
  viewCount: number | null;
  displayedCountIsPlayCount: boolean;
} {
  const playCount = num(node.video_play_count);
  const viewCount = num(node.video_view_count);

  // Q4: video_view_count === 0 is a known-bad value on some reels
  // (ig_reel_1_zero_view_count.json: view=0, play=116333) — fall back to
  // playCount for display, but RECORD the fallback rather than silently
  // swapping the number. Carousel video children never trigger this arm in
  // practice: playCount is always null there (C4), so there is nothing to
  // fall back to.
  const displayedCountIsPlayCount = viewCount === 0 && playCount !== null && playCount > 0;

  return { playCount, viewCount, displayedCountIsPlayCount };
}

// C7: discriminate on __typename/is_video, NEVER on video_url presence — an
// all-image carousel's image children carry `video_url: null` (key present,
// value null), not absent.
function isVideoNode(node: ScrapeCreatorsMedia | ScrapeCreatorsCarouselChildNode): boolean {
  return node.__typename === "XDTGraphVideo" || node.is_video === true;
}

function toPart(
  node: ScrapeCreatorsMedia | ScrapeCreatorsCarouselChildNode,
  index: number,
  isCarouselChild: boolean,
): MediaPart | null {
  const kind: MediaPart["kind"] = isVideoNode(node) ? "video" : "image";
  const url = kind === "video" ? str(node.video_url) : str(node.display_url);
  if (!url) {
    return null;
  }

  const counts = resolveCounts(node);

  return {
    index,
    kind,
    url,
    // C3/Q1=(a): no duration exists anywhere on a carousel payload — never
    // derived, never fabricated. Only a non-carousel video's top-level
    // video_duration is trusted.
    durationSec: kind === "video" && !isCarouselChild ? num(node.video_duration) : null,
    width: num(node.dimensions?.width),
    height: num(node.dimensions?.height),
    playCount: counts.playCount,
    viewCount: counts.viewCount,
    displayedCountIsPlayCount: counts.displayedCountIsPlayCount,
  };
}

function getCarouselChildren(raw: ScrapeCreatorsMedia): ScrapeCreatorsCarouselChildNode[] {
  const edges = raw.edge_sidecar_to_children?.edges;
  if (!Array.isArray(edges)) {
    return [];
  }
  return edges
    .map((edge) => edge.node)
    .filter((node): node is ScrapeCreatorsCarouselChildNode => !!node);
}

/**
 * Enumerates every media part for a post, in document order, and applies the
 * `MAX_MEDIA_PARTS` cap. Ticket #71: `resolveMediaParts()` replaces the old
 * `resolveVideoChild()` — every `edge_sidecar_to_children` node becomes a
 * part; a non-carousel post produces a single-element array (its own video)
 * or an empty array (an image post has no part at all, unchanged behaviour).
 * This convergence applies to part ENUMERATION only — view-count resolution
 * deliberately stays branched by node (C4), never a single shared "resolve
 * the view count of this post" helper.
 */
export function resolveMediaParts(raw: ScrapeCreatorsMedia): ResolvedMediaParts {
  const isCarousel = raw.__typename === "XDTGraphSidecar";

  const candidates: MediaPart[] = [];
  if (isCarousel) {
    const children = getCarouselChildren(raw);
    children.forEach((child, i) => {
      const part = toPart(child, i, true);
      if (part) {
        candidates.push(part);
      }
    });
  } else {
    // A non-carousel post produces a single-element array (its own video)
    // or an EMPTY array for an image post (Step 2) — a lone image post is
    // not sent to Gemini as media, unchanged from pre-#71 behaviour. Only
    // a carousel's image children become MediaParts.
    const part = toPart(raw, 0, false);
    if (part && part.kind === "video") {
      candidates.push(part);
    }
  }

  const totalPartsBeforeCap = candidates.length;
  const truncated = totalPartsBeforeCap > MAX_MEDIA_PARTS;
  const parts = truncated ? candidates.slice(0, MAX_MEDIA_PARTS) : candidates;

  return { parts, totalPartsBeforeCap, truncated };
}
