import type { ScrapeCreatorsCarouselChildNode, ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import { getCarouselEdges } from "@/lib/server/analysis/carousel";
import type { CarouselEdge } from "@/lib/server/analysis/carousel";
import { isVideoNode } from "@/lib/server/analysis/media/resolveMediaParts";
import type { LaterSlideReach, ReachDerivedFrom, ReachKind, ReachResult } from "./types";

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
 *
 * **OR-27 (#254, TDD §0.6/§3/§3.1 item 3) narrows R-12.7.1 — it is
 * DIRECTIONAL, not a blanket ban.** Forbidden direction, unchanged: using
 * `__typename`/`is_video` to SUPPRESS, override or shortcut a reach field
 * that IS present — `hasReachFields()` stays the first gate and always wins
 * whenever the keys exist. Permitted direction, new: consulting a POSITIVE
 * video signal (`isVideoNode()`, the same C7 discriminator
 * `resolveMediaParts.ts` already uses) ONLY INSIDE the non-carousel branch
 * that has already resolved to "no reach keys present" — to distinguish "this
 * content kind genuinely has no reach field" (an image post) from "this is
 * video content whose reach came back missing from the payload" (a thin
 * ScrapeCreators response, see ticket #254). The presence check still runs
 * first and still wins whenever the keys exist; the video signal can never
 * hide a present field and can never fabricate a number. The carousel branch
 * is untouched by OR-27 — its own presence-check-based `hasVideoChild` scan
 * and first-slide/later-slide logic (D4 / OR-26 / R-N1-N3) are unaffected.
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
 * OR-26 / #155 / DESIGN-3C §5.4 (R-N1/R-N2/R-N3). Scans a carousel's
 * PRE-FILTER `edges` for the FIRST one whose node yields a genuinely usable
 * reach number — "usable" means the SAME thing it always has here (owner
 * ruling on PR #158's review): merely carrying the reach KEYS is not
 * enough, a video child whose `video_view_count` is `null`/unusable must
 * not be reported. Reuses `resolveNodeReach(node, "view")` — the SAME
 * resolution path that already rejects the false-zero pattern
 * (`ig_reel_1_zero_view_count.json`) and already applies the child
 * authority reversal (divergence 13: carousel children trust
 * `video_view_count`, never `video_play_count`) — rather than inventing a
 * second, independent definition of "usable" that would walk straight past
 * cases the existing resolver already handles correctly. `AVAILABLE` and
 * `ZERO` both count as usable (a corroborated zero is a real fact,
 * R-4.3.1); only `UNKNOWN` does not.
 *
 * R-N3 is binding: this returns the FIRST usable slide only, never a sum,
 * max or mean across slides — a per-post reach figure D4/R-D3 has
 * explicitly declined to compute.
 *
 * `slideIndex` is deliberately the loop index into `edges` (PRE-filter),
 * not into a compacted/filtered array — follow-up to PR #164's review,
 * item 1. Filtering out falsy `edge.node`s before indexing (as a
 * `.filter((node) => !!node)` step would) shifts every index after a null
 * node down by one and prints a confidently
 * wrong slide number to the user ("slide 6" for what is actually the 7th
 * slide). Indexing into `edges` instead — skipping unusable/null nodes with
 * `continue` rather than removing them from the array first — keeps
 * `slideIndex` matching the position the user actually sees scrolling the
 * carousel, null nodes included. `slideCount` is `edges.length`, the SAME
 * array `slideIndex` is drawn from (never the filtered children array,
 * which would pair a `slideIndex` from one array with a `slideCount` from
 * another and produce a different wrong number, "slide 6 of 9").
 *
 * Scans the WHOLE `edges` array, not `edges.slice(1)`: this is only ever
 * called from the branch where slide 0 has already failed
 * `hasReachFields`, so slide 0 is guaranteed to resolve `UNKNOWN` (or be
 * skipped as a null node) here too — scanning it again is harmless and
 * keeps the index arithmetic simple.
 */
function resolveLaterSlideReach(edges: CarouselEdge[]): LaterSlideReach {
  const slideCount = edges.length;
  for (let index = 0; index < edges.length; index += 1) {
    const node = edges[index]!.node;
    if (!node) {
      continue;
    }
    const resolved = resolveNodeReach(node, "view");
    if (
      (resolved.state === "AVAILABLE" || resolved.state === "ZERO") &&
      resolved.value !== null &&
      resolved.kind !== "UNKNOWN"
    ) {
      return { usable: true, value: resolved.value, kind: resolved.kind, slideIndex: index, slideCount };
    }
  }
  return { usable: false };
}

function noneResult(laterSlideReach: LaterSlideReach = { usable: false }, hasVideo = false): ReachResult {
  return { value: null, kind: null, state: "UNKNOWN", derivedFrom: "NONE", laterSlideReach, hasVideo };
}

/**
 * #254 §3 — observability for the self-contradictory case this ticket makes
 * reachable: a node `isVideoNode()` confirms is video content, yet neither
 * reach KEY is present in the payload. Fires only from the branch above.
 * Never logs the API key or the full raw payload — just the identifying
 * fields and presence booleans needed to diagnose the shape of the payload
 * ScrapeCreators actually returned. The upstream cause is NOT settled (see
 * ticket #254): circumstantial evidence points at a partial GraphQL
 * resolution (`dimensions`, `like_and_view_counts_disabled` and
 * `clips_music_attribution_info` also vanished, `has_audio` flipped on one
 * post within two minutes), but nobody has confirmed it, and it does not
 * change what this function does — it only describes the observed presence
 * booleans, never asserts why they are missing.
 */
function warnThinVideoReach(raw: ScrapeCreatorsMedia): void {
  console.warn("[reach] video content with no reach fields present (thin payload)", {
    id: raw.id,
    shortcode: raw.shortcode,
    __typename: raw.__typename,
    is_video: raw.is_video,
    has_video_play_count: "video_play_count" in raw,
    has_video_view_count: "video_view_count" in raw,
    has_dimensions: "dimensions" in raw,
    has_like_and_view_counts_disabled: "like_and_view_counts_disabled" in raw,
    has_video_url: "video_url" in raw,
    has_video_duration: "video_duration" in raw,
  });
}

/**
 * `resolveInstagramReach()` — the branch table (TDD §3):
 *
 * | Case | `derivedFrom` |
 * |---|---|
 * | Top-level reel/video, reach fields present | `TOP_LEVEL` |
 * | Carousel, first slide (index 0) carries reach fields | `CAROUSEL_FIRST_SLIDE` (D4) |
 * | Carousel with no children, or first slide has neither field (all-image carousel) | `NONE` |
 * | Non-carousel post with neither field, `isVideoNode()` false (single image post) | `NONE` |
 * | Non-carousel post with neither field, `isVideoNode()` true (#254: thin video payload) | `TOP_LEVEL`, `state: "UNKNOWN"` |
 */
export function resolveInstagramReach(raw: ScrapeCreatorsMedia): ReachResult {
  // R-12.7.1: branch on field PRESENCE, never on `__typename`. The
  // `edge_sidecar_to_children` key itself — not the type name — is what
  // discriminates a carousel from a top-level reel/video/image post.
  const isCarousel = "edge_sidecar_to_children" in raw;

  if (isCarousel) {
    // Follow-up to PR #167's review, item B1: resolved from the PRE-filter
    // `edges` array (via `getCarouselEdges`), never from the compacted
    // `getCarouselChildren()` output. If `edges[0].node` is null/absent, the
    // filtered array's index 0 is actually the SECOND slide — reading it as
    // "first slide" would attribute a later slide's view count to a
    // confidently-wrong `CAROUSEL_FIRST_SLIDE` label (worse than the
    // slideIndex off-by-one item 1 already fixed) and would also skip the
    // `REACH_NOT_ON_FIRST_SLIDE` path for a post that qualifies for it.
    const edges = getCarouselEdges(raw);
    const firstSlide = edges[0]?.node;
    // B1 (PR #191 review): scanned once here, over the WHOLE pre-filter
    // `edges` array — the SAME field-presence discriminator `hasReachFields`
    // already applies per-node — and reused for BOTH branches below, so
    // `hasVideo` never depends on which slide happened to carry reach
    // fields first. A carousel with an image on slide 0 and a video on
    // slide 3 (video's own `video_view_count` possibly still unusable)
    // resolves `hasVideo: true` here even though `derivedFrom` stays
    // `"NONE"` — that split is exactly what `isImageOnly` in
    // `prompts/user.ts` must consult instead of `derivedFrom` alone.
    const hasVideoChild = edges.some((edge) => edge.node != null && hasReachFields(edge.node));
    if (!firstSlide || !hasReachFields(firstSlide)) {
      // OR-26 / #155: distinguish "no slide in this carousel carries a
      // reach field" from "slide 0 doesn't, but a later slide does" —
      // the latter is a live reach fact D4's first-slide rule never
      // consulted, not a permanent content-kind limitation.
      //
      // Owner ruling on PR #158's review, carried into DESIGN-3C §5.4's
      // R-N1/R-N2/R-N3: presence of the reach KEYS is not enough — a later
      // video slide with e.g. `video_view_count: null` must not surface a
      // figure (that would make #143 fabricate a number for a slide that
      // has none). Only a slide `resolveNodeReach` actually resolves to
      // AVAILABLE/ZERO, and only its OWN value/kind, travel forward.
      //
      // Review N3 (#175 consolidation): `edges` is computed once above and
      // reused here, rather than calling `getCarouselEdges(raw)` a second
      // time — same behaviour, one fewer redundant derivation.
      const laterSlideReach = resolveLaterSlideReach(edges);
      return noneResult(laterSlideReach, hasVideoChild);
    }

    const node = resolveNodeReach(firstSlide, "view");
    return {
      ...node,
      derivedFrom: "CAROUSEL_FIRST_SLIDE" as ReachDerivedFrom,
      laterSlideReach: { usable: false },
      hasVideo: true,
    };
  }

  if (!hasReachFields(raw)) {
    // OR-27 (#254): permitted direction only. The presence check above has
    // already failed for BOTH keys — nothing here can hide or override a
    // reach field that exists, because none does. `isVideoNode()` is
    // consulted purely to decide which absence-story is true: an image post
    // (genuinely no reach field, `derivedFrom: "NONE"`) vs. video content
    // whose reach field(s) came back missing from a thin ScrapeCreators
    // payload (`derivedFrom: "TOP_LEVEL"`, `state: "UNKNOWN"` — the SAME
    // "field exists but is unusable" shape `resolveYoutubeReach()` already
    // returns for `viewCountInt: null`, not a new state).
    if (isVideoNode(raw)) {
      warnThinVideoReach(raw);
      return {
        value: null,
        kind: "UNKNOWN",
        state: "UNKNOWN",
        derivedFrom: "TOP_LEVEL" as ReachDerivedFrom,
        laterSlideReach: { usable: false },
        hasVideo: true,
      };
    }
    return noneResult();
  }

  const node = resolveNodeReach(raw, "play");
  return {
    ...node,
    derivedFrom: "TOP_LEVEL" as ReachDerivedFrom,
    laterSlideReach: { usable: false },
    hasVideo: true,
  };
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
/**
 * `hasVideo` is unconditionally `true` on every branch here (B1, PR #191
 * review): every YouTube post this module resolves reach for IS a video —
 * there is no YouTube image-only content kind in this pipeline. `NONE`
 * here means "the `viewCountInt` field itself was never in the response",
 * not "no video exists" — unlike Instagram's `NONE`, it must never be read
 * as image-only content by `prompts/user.ts`.
 */
export function resolveYoutubeReach(viewCountInt: unknown): ReachResult {
  if (viewCountInt === undefined) {
    return {
      value: null,
      kind: "UNKNOWN",
      state: "UNKNOWN",
      derivedFrom: "NONE",
      laterSlideReach: { usable: false },
      hasVideo: true,
    };
  }

  const value = num(viewCountInt);

  if (value === null) {
    return {
      value: null,
      kind: "UNKNOWN",
      state: "UNKNOWN",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
      hasVideo: true,
    };
  }
  if (value < 0) {
    return {
      value: null,
      kind: "UNKNOWN",
      state: "UNKNOWN",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
      hasVideo: true,
    };
  }
  if (value === 0) {
    return {
      value: 0,
      kind: "VIEWS",
      state: "ZERO",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
      hasVideo: true,
    };
  }

  return {
    value,
    kind: "VIEWS",
    state: "AVAILABLE",
    derivedFrom: "TOP_LEVEL",
    laterSlideReach: { usable: false },
    hasVideo: true,
  };
}
