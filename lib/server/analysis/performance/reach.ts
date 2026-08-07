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
 * Which field is authoritative for a node — TDD §3's table is directional,
 * not symmetric: a top-level reel/video trusts `video_play_count`; a
 * carousel child trusts `video_view_count` (the reversal, AC-5). There is
 * **no documented fallback** from one to the other in either direction — a
 * top-level node whose `video_play_count` is absent/null is `UNKNOWN`, not
 * silently read from `video_view_count` (that would feed a *view* figure
 * into a *play*-based baseline, PRD §4.3's corruption trap). Only the field
 * this node is authoritative for is ever consulted.
 */
type Authority = "play" | "view";

/**
 * Resolves reach from a single node (a top-level reel/video, or a carousel
 * slide) that is known to carry at least one of the two count fields.
 *
 * - The node's authoritative field (`video_play_count` for a top-level
 *   node, `video_view_count` for a carousel child) is used whenever it is a
 *   positive number — this is what rejects the false zero
 *   (`ig_reel_1_zero_view_count.json`: `video_view_count: 0` beside
 *   `video_play_count: 116333`, AC-4) and resolves the carousel-child
 *   reversal (`video_play_count` is `null` on every real video child,
 *   `video_view_count` is populated, AC-5).
 * - Both fields explicitly `0` is a corroborated, genuine zero (PRD §4.4:
 *   "Only assertable when ... no sibling field contradicts it") — labelled
 *   with the node's own authoritative kind (R-4.3.1: a zero carousel child
 *   is a corroborated `VIEWS` zero, never `PLAYS`).
 * - Anything else (the authoritative field null/absent with no positive
 *   corroboration) is `UNKNOWN` per R-4.3.3 — never fabricated as `0`,
 *   never guessed as a kind, never read from the *other* field.
 */
function resolveNodeReach(
  node: ScrapeCreatorsMedia | ScrapeCreatorsCarouselChildNode,
  authority: Authority,
): NodeReach {
  const playCount = num(node.video_play_count);
  const viewCount = num(node.video_view_count);
  const primary = authority === "play" ? playCount : viewCount;
  const kind: ReachKind = authority === "play" ? "PLAYS" : "VIEWS";

  if (primary !== null && primary > 0) {
    return { value: primary, kind, state: "AVAILABLE" };
  }
  if (playCount === 0 && viewCount === 0) {
    return { value: 0, kind, state: "ZERO" };
  }

  return { value: null, kind: "UNKNOWN", state: "UNKNOWN" };
}

/**
 * OR-26 / #155 / owner ruling on PR #158's code review. `someSlideHasReach`
 * must mean "a later slide yields a genuinely usable number", not merely
 * "a later slide carries the reach keys" — `hasReachFields` alone is
 * presence-only and is flipped `true` by a video child whose
 * `video_view_count` is `null`/unusable, which would make ticket #143 write
 * `REACH_NOT_ON_FIRST_SLIDE` ("the count is on a later slide") for a slide
 * that has no count at all. Reuses `resolveNodeReach(node, "view")` — the
 * SAME resolution path that already rejects the false-zero pattern
 * (`ig_reel_1_zero_view_count.json`) and already applies the child
 * authority reversal (divergence 13: carousel children trust
 * `video_view_count`, never `video_play_count`) — rather than inventing a
 * second, independent definition of "usable" that would walk straight past
 * cases the existing resolver already handles correctly. `AVAILABLE` and
 * `ZERO` both count as usable (a corroborated zero is a real fact, R-4.3.1);
 * only `UNKNOWN` does not.
 */
function childHasUsableReach(node: ScrapeCreatorsCarouselChildNode): boolean {
  const resolved = resolveNodeReach(node, "view");
  return resolved.state === "AVAILABLE" || resolved.state === "ZERO";
}

function noneResult(someSlideHasReach = false): ReachResult {
  return { value: null, kind: null, state: "UNKNOWN", derivedFrom: "NONE", someSlideHasReach };
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
  // R-12.7.1: branch on field PRESENCE, never on `__typename`. The
  // `edge_sidecar_to_children` key itself — not the type name — is what
  // discriminates a carousel from a top-level reel/video/image post.
  const isCarousel = "edge_sidecar_to_children" in raw;

  if (isCarousel) {
    const children = getCarouselChildren(raw);
    const firstSlide = children[0];
    if (!firstSlide || !hasReachFields(firstSlide)) {
      // OR-26 / #155: distinguish "no slide in this carousel carries a
      // reach field" from "slide 0 doesn't, but a later slide does" —
      // the latter is a live reach fact D4's first-slide rule never
      // consulted, not a permanent content-kind limitation.
      //
      // Owner ruling on PR #158's review: presence of the reach KEYS is not
      // enough — a later video slide with e.g. `video_view_count: null`
      // must not flip this to `true` (that would make #143 fabricate
      // `REACH_NOT_ON_FIRST_SLIDE` for a slide with no usable number). Only
      // a slide `resolveNodeReach` actually resolves to AVAILABLE/ZERO
      // counts.
      const someSlideHasReach = children.some(childHasUsableReach);
      return noneResult(someSlideHasReach);
    }

    const node = resolveNodeReach(firstSlide, "view");
    return { ...node, derivedFrom: "CAROUSEL_FIRST_SLIDE" as ReachDerivedFrom, someSlideHasReach: false };
  }

  if (!hasReachFields(raw)) {
    return noneResult();
  }

  const node = resolveNodeReach(raw, "play");
  return { ...node, derivedFrom: "TOP_LEVEL" as ReachDerivedFrom, someSlideHasReach: false };
}

/**
 * YouTube reach (TDD §3 table): `viewCountInt` is the one unambiguous
 * number confirmed live (`.claude/context/verified-facts.md`) — no
 * view-vs-play ambiguity exists on this platform (PRD §4.7). Still routed
 * through the same negative-guard discipline as everything else in this
 * module: a negative or non-finite value is `UNKNOWN`, never clamped.
 *
 * `derivedFrom` mirrors `resolveInstagramReach()`'s meaning: `NONE` is "the
 * field does not exist at all" (`viewCountInt === undefined` — the key was
 * never in the response), while `TOP_LEVEL` is "the field exists" even when
 * its value is unusable (`null`, negative, non-finite).
 */
export function resolveYoutubeReach(viewCountInt: unknown): ReachResult {
  if (viewCountInt === undefined) {
    return { value: null, kind: "UNKNOWN", state: "UNKNOWN", derivedFrom: "NONE", someSlideHasReach: false };
  }

  const value = num(viewCountInt);

  if (value === null) {
    return { value: null, kind: "UNKNOWN", state: "UNKNOWN", derivedFrom: "TOP_LEVEL", someSlideHasReach: false };
  }
  if (value < 0) {
    return { value: null, kind: "UNKNOWN", state: "UNKNOWN", derivedFrom: "TOP_LEVEL", someSlideHasReach: false };
  }
  if (value === 0) {
    return { value: 0, kind: "VIEWS", state: "ZERO", derivedFrom: "TOP_LEVEL", someSlideHasReach: false };
  }

  return { value, kind: "VIEWS", state: "AVAILABLE", derivedFrom: "TOP_LEVEL", someSlideHasReach: false };
}
