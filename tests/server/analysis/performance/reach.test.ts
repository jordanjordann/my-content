import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveInstagramReach, resolveYoutubeReach } from "@/lib/server/analysis/performance/reach";
import type { LaterSlideReach } from "@/lib/server/analysis/performance/types";
import type { ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import {
  makeCarousel,
  makeImageChild,
  makeImagePost,
  makeReel,
  makeVideoChild,
} from "@/tests/fixtures/synthetic/instagramMedia";

const fixturesDir = path.join(process.cwd(), ".claude/context/fixtures/scrapecreators-instagram");

function loadMedia(fixtureName: string): ScrapeCreatorsMedia {
  const raw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, fixtureName), "utf8"),
  ) as { data: { xdt_shortcode_media: ScrapeCreatorsMedia } };
  return raw.data.xdt_shortcode_media;
}

describe("resolveInstagramReach — real fixtures (AC-4, AC-5, AC-6/AC-18)", () => {
  it("AC-4 — a top-level reel with a misleading video_view_count: 0 resolves to the authoritative video_play_count, PLAYS, TOP_LEVEL", () => {
    const media = loadMedia("ig_reel_1_zero_view_count.json");

    const result = resolveInstagramReach(media);

    expect(result).toEqual({
      value: 116_333,
      kind: "PLAYS",
      state: "AVAILABLE",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
    });
  });

  it("AC-5 — a video-bearing carousel's first slide resolves VIEWS via the play/view reversal, CAROUSEL_FIRST_SLIDE", () => {
    const media = loadMedia("ig_carousel_mixed_video_and_image_10_slides.json");

    const result = resolveInstagramReach(media);

    expect(result).toEqual({
      value: 234_050,
      kind: "VIEWS",
      state: "AVAILABLE",
      derivedFrom: "CAROUSEL_FIRST_SLIDE",
      laterSlideReach: { usable: false },
    });
  });

  it("AC-6/AC-18 — an all-image carousel yields no reach value and no kind, derivedFrom NONE", () => {
    const media = loadMedia("ig_carousel_all_images_10_slides.json");

    const result = resolveInstagramReach(media);

    expect(result).toEqual({
      value: null,
      kind: null,
      state: "UNKNOWN",
      derivedFrom: "NONE",
      laterSlideReach: { usable: false },
    });
  });

  it("a single image post also yields NONE — no reach field exists on any non-video content", () => {
    const media = loadMedia("ig_single_image_post.json");

    const result = resolveInstagramReach(media);

    expect(result.derivedFrom).toBe("NONE");
    expect(result.value).toBeNull();
    expect(result.kind).toBeNull();
    // Regression guard for the falsified analysis_mode derivation (TDD
    // §3.1): a single image post is metadata_only, not images_only, so a
    // reader keyed off analysis_mode would misread this as case 2. It is
    // case 1 — no node anywhere carries a reach field.
    expect(result.laterSlideReach).toEqual({ usable: false });
  });

  it("OR-26 / #155 / DESIGN-3C §5.4 — SYNTHETIC MUTANT: a real mixed carousel with its slide-5 image reordered to index 0 resolves NONE, and laterSlideReach carries the FIRST usable later slide's own value/kind/index (R-N2/R-N3), not just a flag", () => {
    // No committed fixture has an image at slide 0 with a video later.
    // `ig_carousel_mixed_video_and_image_10_slides.json` proves this shape
    // is real (images and videos interleave arbitrarily within one
    // carousel — indices 5, 8, 9 are images, everything else video) — this
    // test just reorders slides 0 and 5 of that SAME captured payload via
    // deep clone, so it is a reordering of witnessed data, not a
    // hypothesis. No API credits used or authorised for this ticket.
    //
    // After the swap: index 0 is the (unusable) image, index 1 is the
    // ORIGINAL index-1 video slide (video_view_count: 163868, witnessed in
    // the raw fixture) — the first usable later slide — and index 5 is the
    // original index-0 video slide (234050 views). R-N3 requires the FIRST
    // usable slide (index 1, value 163868), never a sum/max/mean across the
    // several usable slides this carousel actually has.
    const media = loadMedia("ig_carousel_mixed_video_and_image_10_slides.json");
    const cloned = structuredClone(media) as ScrapeCreatorsMedia & {
      edge_sidecar_to_children: { edges: Array<{ node: Record<string, unknown> }> };
    };
    const edges = cloned.edge_sidecar_to_children.edges;
    const slide0 = edges[0]!;
    const slide5 = edges[5]!;
    edges[0] = slide5;
    edges[5] = slide0;

    const result = resolveInstagramReach(cloned);

    expect(result.derivedFrom).toBe("NONE");
    expect(result.value).toBeNull();
    expect(result.kind).toBeNull();
    expect(result.laterSlideReach).toEqual({
      usable: true,
      value: 163_868,
      kind: "VIEWS",
      slideIndex: 1,
      slideCount: 10,
    });
  });

  it("OR-26 / PR #158 review — SYNTHETIC MUTANT: mixed carousel with an image at slide 0 and every later video slide's counts nulled out resolves NONE with laterSlideReach { usable: false } — merely carrying the reach KEYS on a later slide must not fabricate a figure when none of those slides has a usable number (R-N1)", () => {
    // Same reordering as the mutant above (proves the interleaved shape is
    // real, witnessed data, not a hypothesis) but additionally nulls out
    // every remaining video slide's video_view_count/video_play_count. The
    // keys are still PRESENT (hasReachFields would still say true for all
    // of them) — only the VALUES are unusable. This is exactly the
    // regression the owner's ruling on PR #158 flagged: a presence-only
    // check would fabricate a figure here; the fix must not.
    const media = loadMedia("ig_carousel_mixed_video_and_image_10_slides.json");
    // `Omit<..., "edge_sidecar_to_children">` (not a plain intersection) so
    // the declared `Record<string, unknown>` node shape is authoritative
    // and doesn't structurally bleed with `ScrapeCreatorsCarouselChildNode`'s
    // `number | undefined` typing for `video_view_count` — that bleed is
    // what forced the `null as unknown as number` double casts below
    // previously (a plain `A & B` intersection recomputes property types
    // structurally on every access, even when the value was produced via an
    // `unknown` bridge cast).
    const cloned = structuredClone(media) as unknown as Omit<
      ScrapeCreatorsMedia,
      "edge_sidecar_to_children"
    > & {
      edge_sidecar_to_children: {
        edges: Array<{ node: Record<string, unknown> }>;
      };
    };
    const edges = cloned.edge_sidecar_to_children.edges;
    const slide0 = edges[0]!;
    const slide5 = edges[5]!;
    edges[0] = slide5;
    edges[5] = slide0;
    for (const edge of edges) {
      // R-12.7.1: `is_video` is forbidden as a discriminator even here in
      // test setup — divergence 16 records that image-child key sets are
      // not fixed, so gate on the same reach-key presence the module itself
      // reads, not on a type-name-adjacent boolean.
      if ("video_view_count" in edge.node) {
        edge.node.video_view_count = null;
        edge.node.video_play_count = null;
      }
    }

    const result = resolveInstagramReach(cloned);

    expect(result.derivedFrom).toBe("NONE");
    expect(result.value).toBeNull();
    expect(result.kind).toBeNull();
    expect(result.laterSlideReach).toEqual({ usable: false });
  });

  it("OR-20 negative assertion — reach is never negative for any committed Instagram fixture", () => {
    for (const file of fs.readdirSync(fixturesDir)) {
      // ig_profile_business_account.json is a /v1/instagram/profile capture
      // (data.user, not data.xdt_shortcode_media) — not a post payload.
      if (!file.startsWith("ig_") || !file.endsWith(".json") || file === "ig_profile_business_account.json") {
        continue;
      }
      const media = loadMedia(file);
      const result = resolveInstagramReach(media);
      if (result.value !== null) {
        expect(result.value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("resolveInstagramReach — synthetic branch pins", () => {
  it("a top-level reel with a positive video_view_count and no play count is UNKNOWN — TDD §3's ladder gives top-level nodes no view fallback, only video_play_count is authoritative", () => {
    const media = makeReel({ video_play_count: undefined, video_view_count: 5_000 });

    const result = resolveInstagramReach(media);

    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
    expect(result.kind).toBe("UNKNOWN");
    expect(result.derivedFrom).toBe("TOP_LEVEL");
  });

  it("both play and view counts corroborated at exactly 0 is a genuine ZERO, not UNKNOWN", () => {
    const media = makeReel({ video_play_count: 0, video_view_count: 0 });

    expect(resolveInstagramReach(media)).toEqual({
      value: 0,
      kind: "PLAYS",
      state: "ZERO",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
    });
  });

  it("R-4.3.3 — a bare 0 view count with no play-count field at all is UNKNOWN, never ZERO", () => {
    const media = makeReel({ video_play_count: undefined, video_view_count: 0 });

    const result = resolveInstagramReach(media);

    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
    expect(result.kind).toBe("UNKNOWN");
    expect(result.derivedFrom).toBe("TOP_LEVEL");
  });

  it("a carousel whose first slide (index 0) is an image with a later video slide still resolves NONE — the rule is literally the FIRST slide, not the first video slide — and laterSlideReach carries that later slide's own value/kind/index", () => {
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_view_count: 999 }),
    ]);

    const result = resolveInstagramReach(media);
    expect(result.derivedFrom).toBe("NONE");
    // OR-26 / #155 / R-N2: this is exactly case 2 — slide 0 has no reach
    // fields but a later slide does, with a genuinely usable value — so the
    // figure and its kind must travel together, at the later slide's index.
    expect(result.laterSlideReach).toEqual({
      usable: true,
      value: 999,
      kind: "VIEWS",
      slideIndex: 1,
      slideCount: 2,
    });
  });

  it("OR-26 / PR #158 review — a later slide carrying the reach KEYS but only unusable values (both null) is NOT usable — laterSlideReach stays { usable: false }, distinguishing it from the genuinely-usable-later-slide case above", () => {
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_view_count: null, video_play_count: null }),
    ]);

    const result = resolveInstagramReach(media);
    expect(result.derivedFrom).toBe("NONE");
    expect(result.laterSlideReach).toEqual({ usable: false });
  });

  it("PR #161 review R1 — a later slide corroborated at exactly 0 (both fields 0) counts as usable, laterSlideReach carries figure 0 with kind VIEWS — pins the ZERO clause against deletion (R-N1: 0 is a real measurement, not a missing figure)", () => {
    // This is the single judgement call this PR exists to make: `ZERO` is
    // usable, same as `AVAILABLE`. If the resolver were narrowed to
    // `resolved.state === "AVAILABLE"` (dropping the `|| state === "ZERO"`
    // clause), this test is the one that would fail — see the mutation
    // proof in the PR thread.
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_play_count: 0, video_view_count: 0 }),
    ]);

    const result = resolveInstagramReach(media);
    expect(result.derivedFrom).toBe("NONE");
    expect(result.laterSlideReach).toEqual({
      usable: true,
      value: 0,
      kind: "VIEWS",
      slideIndex: 1,
      slideCount: 2,
    });
  });

  it("PR #161 review R2 — a later slide's false zero (video_view_count: 0 beside a real non-zero video_play_count) is NOT usable, laterSlideReach { usable: false } — pins the ig_reel_1_zero_view_count.json false-zero rejection on the CHILD path, not just the top-level path AC-4 already covers", () => {
    // The child's authoritative field is video_view_count (divergence 13),
    // and here it reads 0 while video_play_count — a field this node is NOT
    // authoritative for — is a real non-zero count. resolveNodeReach must
    // not corroborate a ZERO from a field it isn't authoritative for, and
    // must not treat the authoritative-but-zero field as usable without
    // that corroboration. Without this pin, nothing in the child path
    // exercises the exact shape that would fabricate a figure off a false
    // zero.
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_view_count: 0, video_play_count: 116_333 }),
    ]);

    const result = resolveInstagramReach(media);
    expect(result.derivedFrom).toBe("NONE");
    expect(result.laterSlideReach).toEqual({ usable: false });
  });

  it("PR #161 review R3 — a realistic zero-view child (video_view_count: 0, video_play_count: null, the shape every real video carousel child actually has per divergence 12) resolves laterSlideReach { usable: false }, not a ZERO figure — documents that this conservative outcome is deliberate, not accidental", () => {
    // Divergence 12: every real carousel video child carries
    // video_play_count: null (confirmed across all 7 video children in
    // ig_carousel_mixed_video_and_image_10_slides.json). ZERO requires BOTH
    // fields to read exactly 0 — no witnessed payload satisfies that, so
    // this is the outcome real data actually produces today: UNKNOWN, not
    // ZERO, and therefore not usable.
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_view_count: 0, video_play_count: null }),
    ]);

    const result = resolveInstagramReach(media);
    expect(result.derivedFrom).toBe("NONE");
    expect(result.laterSlideReach).toEqual({ usable: false });
  });

  it("R-N3 — when MULTIPLE later slides are usable, laterSlideReach reports the FIRST one only, never a sum, max or mean across slides", () => {
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_view_count: 100 }),
      makeVideoChild({ video_view_count: 99_999 }),
    ]);

    const result = resolveInstagramReach(media);
    expect(result.derivedFrom).toBe("NONE");
    // Not 100_099 (sum), not 99_999 (max), not 50_049.5 (mean) — the first
    // usable slide's own figure, at its own index.
    expect(result.laterSlideReach).toEqual({
      usable: true,
      value: 100,
      kind: "VIEWS",
      slideIndex: 1,
      slideCount: 3,
    });
  });

  it("R-4.3.1 — a carousel first slide corroborated at exactly 0 is a genuine ZERO labelled VIEWS, never PLAYS — the child's authoritative field is video_view_count, not video_play_count", () => {
    const media = makeCarousel([
      makeVideoChild({ video_play_count: 0, video_view_count: 0 }),
    ]);

    expect(resolveInstagramReach(media)).toEqual({
      value: 0,
      kind: "VIEWS",
      state: "ZERO",
      derivedFrom: "CAROUSEL_FIRST_SLIDE",
      laterSlideReach: { usable: false },
    });
  });

  it("an empty carousel (no children) resolves NONE rather than throwing", () => {
    const media = makeCarousel([]);

    // [].some(...) is false — the empty-children case falls out correctly
    // without a special case (OR-26 / #155).
    expect(resolveInstagramReach(media)).toEqual({
      value: null,
      kind: null,
      state: "UNKNOWN",
      derivedFrom: "NONE",
      laterSlideReach: { usable: false },
    });
  });

  it("R-12.7.1 — a non-sidecar image post with no reach fields and no children is NONE (sanity case, not itself proof of non-branching — see the next test)", () => {
    const media = makeImagePost();

    expect(resolveInstagramReach(media).derivedFrom).toBe("NONE");
    expect("video_play_count" in media).toBe(false);
    expect("video_view_count" in media).toBe(false);
  });

  it("R-12.7.1 — does not branch on __typename: a carousel with a misleading/wrong __typename still resolves via its first slide, because edge_sidecar_to_children's PRESENCE decides the branch, not the type name", () => {
    // __typename says "XDTGraphVideo" (a top-level video type, not a
    // sidecar) while the object nonetheless carries edge_sidecar_to_children
    // with a reach-bearing video child. A __typename-gated implementation
    // treats this as top-level, finds no video_play_count/video_view_count
    // keys on the top-level object itself, and returns NONE — the exact
    // "real post silently becomes no reach field exists at all" failure the
    // reviewer demonstrated on the real mixed-carousel fixture. A
    // presence-gated implementation correctly follows edge_sidecar_to_children
    // into the first slide regardless of what __typename claims.
    const media = makeCarousel(
      [makeVideoChild({ video_play_count: null, video_view_count: 42_000 })],
      { __typename: "XDTGraphVideo" },
    );

    expect(resolveInstagramReach(media)).toEqual({
      value: 42_000,
      kind: "VIEWS",
      state: "AVAILABLE",
      derivedFrom: "CAROUSEL_FIRST_SLIDE",
      laterSlideReach: { usable: false },
    });
  });

  it("counts as a string are accepted the same way num() does elsewhere in the codebase", () => {
    const media = makeReel({
      video_play_count: "116333" as unknown as number,
      video_view_count: 0,
    });

    expect(resolveInstagramReach(media)).toMatchObject({ value: 116_333, kind: "PLAYS" });
  });
});

describe("LaterSlideReach — provenance & type guarantees (PR #164 review follow-up, items 1-3)", () => {
  it("item 1 — a null edge.node BEFORE the usable slide does not shift slideIndex: the reported index still matches the user-visible slide position, not the filtered-array position", () => {
    // Slide 0: image (unusable, no reach fields). Slide 1: a null
    // `edge.node` — the exact shape `getCarouselChildren`'s
    // `.filter((node) => !!node)` drops. Slide 2: the usable video.
    //
    // Indexing into the FILTERED children array (the pre-fix bug) would
    // report this as slideIndex 1 — "slide 2" in one-based mockup copy —
    // when the user actually sees it as the 3rd slide (index 2, "slide 3").
    // Indexing into the pre-filter `edges` array (the fix) reports the
    // correct index 2.
    const media = makeCarousel([makeImageChild(), makeVideoChild({ video_view_count: 999 })]);
    const edges = media.edge_sidecar_to_children!.edges! as Array<{
      node?: ReturnType<typeof makeVideoChild> | null;
    }>;
    edges.splice(1, 0, { node: null });

    const result = resolveInstagramReach(media);

    expect(result.derivedFrom).toBe("NONE");
    expect(result.laterSlideReach).toEqual({
      usable: true,
      value: 999,
      kind: "VIEWS",
      // NOT 1 (the filtered-array position) — 2, the user-visible position
      // in the actual (pre-filter) carousel.
      slideIndex: 2,
      // Pre-filter edges.length (3), the SAME array slideIndex is drawn
      // from — NOT 2 (the filtered children.length), which would produce
      // "slide 3 of 2", a different confidently wrong number.
      slideCount: 3,
    });
  });

  it("PR #167 review B1 — a null edge.node AT slide 0 must not shift a later slide's value into the CAROUSEL_FIRST_SLIDE branch", () => {
    // Slide 0: a null `edge.node`. Slide 1: the usable video. Resolving
    // "first slide" from the FILTERED array (the pre-fix bug) would make
    // the video appear at filtered index 0 and classify this post
    // `CAROUSEL_FIRST_SLIDE` — attributing slide 2's view count to slide 1
    // under a confidently wrong label. The fix must resolve slide 0 from
    // the pre-filter `edges` array, see it is null, fail `hasReachFields`,
    // and fall through to the later-slide scan instead.
    const media = makeCarousel([makeVideoChild({ video_view_count: 999 })]);
    const edges = media.edge_sidecar_to_children!.edges! as Array<{
      node?: ReturnType<typeof makeVideoChild> | null;
    }>;
    edges.unshift({ node: null });

    const result = resolveInstagramReach(media);

    expect(result.derivedFrom).toBe("NONE");
    expect(result.value).toBeNull();
    expect(result.laterSlideReach).toEqual({
      usable: true,
      value: 999,
      kind: "VIEWS",
      slideIndex: 1,
      slideCount: 2,
    });
  });

  it("item 1 — a null edge.node AFTER the usable slide does not affect slideIndex or slideCount", () => {
    const media = makeCarousel([makeImageChild(), makeVideoChild({ video_view_count: 999 })]);
    const edges = media.edge_sidecar_to_children!.edges! as Array<{
      node?: ReturnType<typeof makeVideoChild> | null;
    }>;
    edges.push({ node: null });

    const result = resolveInstagramReach(media);

    expect(result.laterSlideReach).toEqual({
      usable: true,
      value: 999,
      kind: "VIEWS",
      slideIndex: 1,
      slideCount: 3,
    });
  });

  it("item 3 — slideIndex and slideCount are REQUIRED on the usable:true variant: a construction omitting either does not compile", () => {
    // Type-level assertion (pins the #164 review's item 3 fix). Before the
    // fix, `slideIndex` was optional (`slideIndex?: number`), so this
    // object was assignable to `LaterSlideReach` with no error. After the
    // fix, both lines below are `tsc` errors; `@ts-expect-error` fails the
    // build if either field is ever made optional again.
    // @ts-expect-error — `slideIndex` is required on the `usable: true` variant.
    const missingSlideIndex: LaterSlideReach = { usable: true, value: 5, kind: "VIEWS", slideCount: 3 };
    // @ts-expect-error — `slideCount` is required on the `usable: true` variant.
    const missingSlideCount: LaterSlideReach = { usable: true, value: 5, kind: "VIEWS", slideIndex: 0 };
    expect(missingSlideIndex).toBeDefined();
    expect(missingSlideCount).toBeDefined();
  });

  it("R-N2 still holds after items 1-3: `{ usable: true, value }` with no `kind` does not type-check, and `usable: false` has no path to a value", () => {
    // @ts-expect-error — `kind` is required whenever `usable: true` (R-N2).
    const noKind: LaterSlideReach = { usable: true, value: 5, slideIndex: 0, slideCount: 1 };
    const unusable: LaterSlideReach = { usable: false };
    // @ts-expect-error — `usable: false` has no `value` field at all.
    expect(unusable.value).toBeUndefined();
    expect(noKind).toBeDefined();
  });

  it("PR #167 review B2 — `kind` structurally excludes \"UNKNOWN\" (R-N2): a bare `{ usable: true, ... kind: \"UNKNOWN\" }` does not type-check", () => {
    // @ts-expect-error — `kind` on the `usable: true` variant is
    // `Exclude<ReachKind, "UNKNOWN">`; "UNKNOWN" is not assignable.
    const unknownKind: LaterSlideReach = {
      usable: true,
      value: 5,
      kind: "UNKNOWN",
      slideIndex: 0,
      slideCount: 1,
    };
    expect(unknownKind).toBeDefined();
  });

  it("PR #167 review B3 — `usable: false` has no read path to `slideIndex`, `slideCount` or `kind` either (only `value` was pinned before)", () => {
    const unusable: LaterSlideReach = { usable: false };
    // @ts-expect-error — `usable: false` has no `slideIndex` field at all.
    expect(unusable.slideIndex).toBeUndefined();
    // @ts-expect-error — `usable: false` has no `slideCount` field at all.
    expect(unusable.slideCount).toBeUndefined();
    // @ts-expect-error — `usable: false` has no `kind` field at all.
    expect(unusable.kind).toBeUndefined();
  });
});

describe("resolveYoutubeReach", () => {
  it("a positive viewCountInt resolves AVAILABLE / VIEWS", () => {
    expect(resolveYoutubeReach(58_622_648)).toEqual({
      value: 58_622_648,
      kind: "VIEWS",
      state: "AVAILABLE",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
    });
  });

  it("null resolves UNKNOWN, never a fabricated zero", () => {
    const result = resolveYoutubeReach(null);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });

  it("undefined (field absent) resolves UNKNOWN with derivedFrom NONE — the key never existed in the response", () => {
    const result = resolveYoutubeReach(undefined);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
    expect(result.derivedFrom).toBe("NONE");
    // OR-26 / #155: YouTube has no slides — always unusable, and neither
    // carousel-specific unavailableReason value may ever appear on this
    // path.
    expect(result.laterSlideReach).toEqual({ usable: false });
  });

  it("null (field present but null) resolves UNKNOWN with derivedFrom TOP_LEVEL — the key exists, just its value doesn't", () => {
    const result = resolveYoutubeReach(null);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
    expect(result.derivedFrom).toBe("TOP_LEVEL");
  });

  it("a negative viewCountInt resolves UNKNOWN, never clamped to 0", () => {
    const result = resolveYoutubeReach(-1);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });

  it("an explicit 0 is ZERO, not UNKNOWN — YouTube has no view/play ambiguity to cast doubt on it", () => {
    expect(resolveYoutubeReach(0)).toEqual({
      value: 0,
      kind: "VIEWS",
      state: "ZERO",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
    });
  });
});
