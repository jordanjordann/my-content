import type { ScrapeCreatorsCarouselChildNode, ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import type { ReachDerivedFrom, ReachKind, ReachResult } from "./types";

/**
 * Reach resolution (TDD §3, ticket #140 step 2). **R-12.7.1 is binding:
 * branch on field PRESENCE only.** Never on `__typename`, never on "is this
 * image content" — verified-facts' 2026-08-05 correction proves both
 * discriminators wrong (two `XDTGraphSidecar` payloads differ from each
 * other; an `XDTGraphImage` single-image post carries fields the all-image
 * carousel does not, see `.claude/context/fixtures/scrapecreators-instagram/`).
 *
 * The one fact that DOES discriminate reliably, confirmed by reading every
 * committed fixture's raw key set (not inferred from the TypeScript types):
 * a node that can carry reach data has the `video_play_count`/
 * `video_view_count` KEYS present (even when one of them is `null`); a node
 * that cannot (an image slide, an all-image carousel, a single image post)
 * has neither key at all. That presence check — not `__typename`, not
 * `is_video` — is what decides `derivedFrom: "NONE"` below.
 */

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function hasReachFields(node: ScrapeCreatorsMedia | ScrapeCreatorsCarouselChildNode): boolean {
  return "video_play_count" in node || "video_view_count" in node;
}

interface NodeReach {
  value: number | null;
  kind: ReachKind;
  state: "AVAILABLE" | "ZERO" | "UNKNOWN";
}

/**
 * Resolves reach from a single node (a top-level reel/video, or a carousel
 * slide) that is known to carry at least one of the two count fields.
 *
 * - `video_play_count` is authoritative whenever it is a positive number —
 *   this is what rejects the false zero (`ig_reel_1_zero_view_count.json`:
 *   `video_view_count: 0` beside `video_play_count: 116333`, AC-4).
 * - Falls back to `video_view_count` when it is the only positive number
 *   present — this is the carousel-child reversal (`video_play_count` is
 *   `null` on every real video child; `video_view_count` is populated,
 *   AC-5).
 * - Both fields explicitly `0` is a corroborated, genuine zero (PRD §4.4:
 *   "Only assertable when ... no sibling field contradicts it").
 * - Anything else (a bare 0 with no positive corroboration, or both
 *   null/absent despite the field key being present) is `UNKNOWN` per
 *   R-4.3.3 — never fabricated as `0`, never guessed as a kind.
 */
function resolveNodeReach(node: ScrapeCreatorsMedia | ScrapeCreatorsCarouselChildNode): NodeReach {
  const playCount = num(node.video_play_count);
  const viewCount = num(node.video_view_count);

  if (playCount !== null && playCount > 0) {
    return { value: playCount, kind: "PLAYS", state: "AVAILABLE" };
  }
  if (viewCount !== null && viewCount > 0) {
    return { value: viewCount, kind: "VIEWS", state: "AVAILABLE" };
  }
  if (playCount === 0 && viewCount === 0) {
    return { value: 0, kind: "PLAYS", state: "ZERO" };
  }

  return { value: null, kind: "UNKNOWN", state: "UNKNOWN" };
}

function noneResult(): ReachResult {
  return { value: null, kind: null, state: "UNKNOWN", derivedFrom: "NONE" };
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
 * `resolveInstagramReach()` — the branch table (TDD §3):
 *
 * | Case | `derivedFrom` |
 * |---|---|
 * | Top-level reel/video, reach fields present | `TOP_LEVEL` |
 * | Carousel, first slide (index 0) carries reach fields | `CAROUSEL_FIRST_SLIDE` (D4) |
 * | Carousel with no children, or first slide has neither field (all-image carousel) | `NONE` |
 * | Non-carousel post with neither field (single image post) | `NONE` |
 */
export function resolveInstagramReach(raw: ScrapeCreatorsMedia): ReachResult {
  const isCarousel = raw.__typename === "XDTGraphSidecar";

  if (isCarousel) {
    const children = getCarouselChildren(raw);
    const firstSlide = children[0];
    if (!firstSlide || !hasReachFields(firstSlide)) {
      return noneResult();
    }

    const node = resolveNodeReach(firstSlide);
    return { ...node, derivedFrom: "CAROUSEL_FIRST_SLIDE" as ReachDerivedFrom };
  }

  if (!hasReachFields(raw)) {
    return noneResult();
  }

  const node = resolveNodeReach(raw);
  return { ...node, derivedFrom: "TOP_LEVEL" as ReachDerivedFrom };
}

/**
 * YouTube reach (TDD §3 table): `viewCountInt` is the one unambiguous
 * number confirmed live (`.claude/context/verified-facts.md`) — no
 * view-vs-play ambiguity exists on this platform (PRD §4.7). Still routed
 * through the same negative-guard discipline as everything else in this
 * module: a negative or non-finite value is `UNKNOWN`, never clamped.
 */
export function resolveYoutubeReach(viewCountInt: unknown): ReachResult {
  const value = num(viewCountInt);

  if (value === null) {
    return { value: null, kind: "UNKNOWN", state: "UNKNOWN", derivedFrom: "TOP_LEVEL" };
  }
  if (value < 0) {
    return { value: null, kind: "UNKNOWN", state: "UNKNOWN", derivedFrom: "TOP_LEVEL" };
  }
  if (value === 0) {
    return { value: 0, kind: "VIEWS", state: "ZERO", derivedFrom: "TOP_LEVEL" };
  }

  return { value, kind: "VIEWS", state: "AVAILABLE", derivedFrom: "TOP_LEVEL" };
}
