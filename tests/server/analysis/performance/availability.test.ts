import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveInstagramCommentAvailability,
  resolveInstagramLikeAvailability,
  resolveYoutubeCommentAvailability,
  resolveYoutubeLikeAvailability,
} from "@/lib/server/analysis/performance/availability";
import type { ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";

const fixturesDir = path.join(process.cwd(), ".claude/context/fixtures/scrapecreators-instagram");

function loadMedia(fixtureName: string): ScrapeCreatorsMedia {
  const raw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, fixtureName), "utf8"),
  ) as { data: { xdt_shortcode_media: ScrapeCreatorsMedia } };
  return raw.data.xdt_shortcode_media;
}

describe("resolveInstagramLikeAvailability — OR-20 / the -1 sentinel", () => {
  it("against the real V1 fixture: resolves HIDDEN, and neither -1 nor 0 reaches the result value", () => {
    const media = loadMedia("ig_post_counts_disabled.json");
    expect(media.like_and_view_counts_disabled).toBe(true);
    expect(media.edge_media_preview_like?.count).toBe(-1);

    const result = resolveInstagramLikeAvailability({
      rawCount: media.edge_media_preview_like?.count,
      likeAndViewCountsDisabled: media.like_and_view_counts_disabled,
    });

    expect(result.state).toBe("HIDDEN");
    expect(result.value).toBeNull();
    expect(result.value).not.toBe(-1);
    expect(result.value).not.toBe(0);
  });

  it("non-vacuity — a synthetic -1 with the disabled flag STRIPPED still resolves UNKNOWN, proving the negative guard stands alone", () => {
    const result = resolveInstagramLikeAvailability({
      rawCount: -1,
      likeAndViewCountsDisabled: undefined,
    });

    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });

  it("non-vacuity variant — a synthetic -1 with the disabled flag explicitly false still resolves UNKNOWN", () => {
    const result = resolveInstagramLikeAvailability({
      rawCount: -1,
      likeAndViewCountsDisabled: false,
    });

    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });

  it("never clamps: -1 does not become 0", () => {
    const result = resolveInstagramLikeAvailability({
      rawCount: -1,
      likeAndViewCountsDisabled: false,
    });

    expect(result.value).not.toBe(0);
  });

  it("AC-19 — an ABSENT like_and_view_counts_disabled is never read as false: a genuinely absent flag with a real count still resolves the count, not HIDDEN", () => {
    const media = loadMedia("ig_carousel_all_images_10_slides.json");
    expect(media.like_and_view_counts_disabled).toBeUndefined();

    const result = resolveInstagramLikeAvailability({
      rawCount: media.edge_media_preview_like?.count,
      likeAndViewCountsDisabled: media.like_and_view_counts_disabled,
    });

    // The flag being absent must not short-circuit to HIDDEN.
    expect(result.state).not.toBe("HIDDEN");
  });

  it("a real, present, non-negative count with the flag false resolves AVAILABLE", () => {
    const result = resolveInstagramLikeAvailability({
      rawCount: 900,
      likeAndViewCountsDisabled: false,
    });

    expect(result).toEqual({ value: 900, state: "AVAILABLE" });
  });

  it("an explicit, uncontradicted 0 with the flag false resolves ZERO", () => {
    const result = resolveInstagramLikeAvailability({
      rawCount: 0,
      likeAndViewCountsDisabled: false,
    });

    expect(result).toEqual({ value: 0, state: "ZERO" });
  });

  it("a null count with the flag false resolves UNKNOWN (never coerced to 0)", () => {
    const result = resolveInstagramLikeAvailability({
      rawCount: null,
      likeAndViewCountsDisabled: false,
    });

    expect(result).toEqual({ value: null, state: "UNKNOWN" });
  });
});

describe("resolveInstagramCommentAvailability — OR-20, comments unaffected", () => {
  it("against the real V1 fixture: commentCount survives un-nulled (1), the guard is not widened to comments", () => {
    const media = loadMedia("ig_post_counts_disabled.json");
    expect(media.edge_media_to_parent_comment?.count).toBe(1);

    const result = resolveInstagramCommentAvailability(media.edge_media_to_parent_comment?.count);

    expect(result).toEqual({ value: 1, state: "AVAILABLE" });
  });

  it("still applies the universal negative guard even though there is no disabled flag for comments", () => {
    const result = resolveInstagramCommentAvailability(-3);

    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });
});

describe("OR-20 negative assertion — no availability resolver ever returns a negative value for any committed Instagram fixture", () => {
  it("across every fixture's like and comment fields", () => {
    for (const file of fs.readdirSync(fixturesDir)) {
      // ig_profile_business_account.json is a /v1/instagram/profile capture
      // (data.user, not data.xdt_shortcode_media) — not a post payload.
      if (!file.startsWith("ig_") || !file.endsWith(".json") || file === "ig_profile_business_account.json") {
        continue;
      }
      const media = loadMedia(file);

      const like = resolveInstagramLikeAvailability({
        rawCount: media.edge_media_preview_like?.count,
        likeAndViewCountsDisabled: media.like_and_view_counts_disabled,
      });
      const comment = resolveInstagramCommentAvailability(media.edge_media_to_parent_comment?.count);

      if (like.value !== null) {
        expect(like.value).toBeGreaterThanOrEqual(0);
      }
      if (comment.value !== null) {
        expect(comment.value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("resolveYoutubeLikeAvailability — OR-21, the conservative rule, all three cases", () => {
  it("case 1 — an explicit 0 resolves UNKNOWN, never ZERO", () => {
    const result = resolveYoutubeLikeAvailability(0);

    expect(result).toEqual({ value: null, state: "UNKNOWN" });
  });

  it("case 2 — null resolves UNKNOWN", () => {
    const result = resolveYoutubeLikeAvailability(null);

    expect(result).toEqual({ value: null, state: "UNKNOWN" });
  });

  it("case 3 — field-absent (undefined) resolves UNKNOWN", () => {
    const result = resolveYoutubeLikeAvailability(undefined);

    expect(result).toEqual({ value: null, state: "UNKNOWN" });
  });

  it("a genuine positive likeCountInt resolves AVAILABLE", () => {
    const result = resolveYoutubeLikeAvailability(4_521);

    expect(result).toEqual({ value: 4_521, state: "AVAILABLE" });
  });

  it("a negative likeCountInt (never observed live, defensive only) resolves UNKNOWN, not clamped", () => {
    const result = resolveYoutubeLikeAvailability(-1);

    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });
});

describe("resolveYoutubeCommentAvailability", () => {
  it("a genuine positive count resolves AVAILABLE", () => {
    expect(resolveYoutubeCommentAvailability(12)).toEqual({ value: 12, state: "AVAILABLE" });
  });

  it("an explicit 0 resolves ZERO — OR-21 is likeCountInt-specific, not a blanket YouTube rule", () => {
    expect(resolveYoutubeCommentAvailability(0)).toEqual({ value: 0, state: "ZERO" });
  });

  it("a negative count resolves UNKNOWN", () => {
    const result = resolveYoutubeCommentAvailability(-5);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });
});
