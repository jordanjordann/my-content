import { afterEach, describe, expect, it, vi } from "vitest";

import { adaptPostResponse, extractOwnerProfile } from "@/lib/server/analysis/fetcher/adapter";
import {
  IG_POST_URL,
  IG_REEL_URL,
  makeCarousel,
  makeImageChild,
  makeImagePost,
  makeReel,
  makeVideoChild,
} from "@/tests/fixtures/synthetic/instagramMedia";

/**
 * Behaviour pins for `adaptPostResponse()` / `extractOwnerProfile()`.
 *
 * Inputs are SYNTHETIC (see `tests/fixtures/synthetic/instagramMedia.ts`) —
 * `/v1/instagram/post` captures are not committed and could not be captured
 * for this ticket without live, credit-charged API calls. These tests
 * therefore pin the adapter's own branching, which is what a prompt/parser
 * rewrite can regress. They do **not** certify the upstream response shape;
 * that gap is tracked in `tests/fixtures/README.md`.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adaptPostResponse — media-type resolution", () => {
  it("resolves a clips product_type to reel", () => {
    const result = adaptPostResponse(makeReel(), IG_REEL_URL);

    expect(result.mediaType).toBe("reel");
    expect(result.carouselItemCount).toBeNull();
  });

  it("resolves a /reel/ URL to reel even without product_type", () => {
    const result = adaptPostResponse(makeReel({ product_type: undefined }), IG_REEL_URL);

    expect(result.mediaType).toBe("reel");
  });

  it("resolves a still image on a /p/ URL to post", () => {
    const result = adaptPostResponse(makeImagePost(), IG_POST_URL);

    expect(result.mediaType).toBe("post");
    expect(result.carouselItemCount).toBeNull();
  });

  it("resolves a sidecar to carousel and counts its children", () => {
    const media = makeCarousel([makeImageChild(), makeImageChild(), makeVideoChild()]);

    const result = adaptPostResponse(media, IG_POST_URL);

    expect(result.mediaType).toBe("carousel");
    expect(result.carouselItemCount).toBe(3);
  });

  it("takes __typename over the URL — a sidecar on a /reel/ URL is still a carousel", () => {
    const media = makeCarousel([makeImageChild()]);

    expect(adaptPostResponse(media, IG_REEL_URL).mediaType).toBe("carousel");
  });

  it("counts an empty sidecar as zero children rather than null", () => {
    const media = makeCarousel([]);

    expect(adaptPostResponse(media, IG_POST_URL).carouselItemCount).toBe(0);
  });
});

describe("adaptPostResponse — resolveVideoUrl", () => {
  it("uses the top-level video_url for a reel", () => {
    expect(adaptPostResponse(makeReel(), IG_REEL_URL).videoUrl).toBe(
      "https://cdn.example/reel.mp4",
    );
  });

  it("returns null for an image post with no video_url", () => {
    expect(adaptPostResponse(makeImagePost(), IG_POST_URL).videoUrl).toBeNull();
  });

  it("selects the FIRST video slide in document order for a multi-video carousel", () => {
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ id: "first-video", video_url: "https://cdn.example/first.mp4" }),
      makeVideoChild({ id: "second-video", video_url: "https://cdn.example/second.mp4" }),
    ]);

    expect(adaptPostResponse(media, IG_POST_URL).videoUrl).toBe("https://cdn.example/first.mp4");
  });

  it("treats is_video: true as a video slide even without the XDTGraphVideo typename", () => {
    const media = makeCarousel([
      makeImageChild(),
      makeImageChild({
        id: "untyped-video",
        is_video: true,
        video_url: "https://cdn.example/untyped.mp4",
      }),
    ]);

    expect(adaptPostResponse(media, IG_POST_URL).videoUrl).toBe("https://cdn.example/untyped.mp4");
  });

  it("returns null for an all-image carousel", () => {
    const media = makeCarousel([makeImageChild(), makeImageChild()]);

    expect(adaptPostResponse(media, IG_POST_URL).videoUrl).toBeNull();
  });

  it("ignores a top-level video_url on a sidecar — carousels resolve from the child only", () => {
    const media = makeCarousel([makeImageChild()], {
      video_url: "https://cdn.example/should-be-ignored.mp4",
    });

    expect(adaptPostResponse(media, IG_POST_URL).videoUrl).toBeNull();
  });

  it("returns null when the resolved video child carries no video_url", () => {
    const media = makeCarousel([makeVideoChild({ video_url: undefined })]);

    expect(adaptPostResponse(media, IG_POST_URL).videoUrl).toBeNull();
  });

  it("does not accept a blank video_url as a URL", () => {
    expect(adaptPostResponse(makeReel({ video_url: "   " }), IG_REEL_URL).videoUrl).toBeNull();
  });
});

describe("adaptPostResponse — resolveThumbnailUrl fallback chain", () => {
  it("prefers thumbnail_src", () => {
    expect(adaptPostResponse(makeReel(), IG_REEL_URL).thumbnailUrl).toBe(
      "https://cdn.example/reel-thumb.jpg",
    );
  });

  it("falls back to display_url when thumbnail_src is absent", () => {
    const media = makeReel({ thumbnail_src: undefined });

    expect(adaptPostResponse(media, IG_REEL_URL).thumbnailUrl).toBe(
      "https://cdn.example/reel-display.jpg",
    );
  });

  it("falls back to the FIRST carousel child's thumbnail_src", () => {
    const media = makeCarousel([
      makeImageChild({ thumbnail_src: "https://cdn.example/first-child-thumb.jpg" }),
      makeVideoChild(),
    ]);

    expect(adaptPostResponse(media, IG_POST_URL).thumbnailUrl).toBe(
      "https://cdn.example/first-child-thumb.jpg",
    );
  });

  it("falls back to the first carousel child's display_url when it has no thumbnail_src", () => {
    const media = makeCarousel([makeImageChild(), makeVideoChild()]);

    expect(adaptPostResponse(media, IG_POST_URL).thumbnailUrl).toBe(
      "https://cdn.example/child-image-display.jpg",
    );
  });

  it("returns null when nothing in the chain resolves", () => {
    const media = makeCarousel([makeImageChild({ display_url: undefined })]);

    expect(adaptPostResponse(media, IG_POST_URL).thumbnailUrl).toBeNull();
  });
});

describe("adaptPostResponse — resolveAudio", () => {
  it("sources audio from the top level for a reel", () => {
    const result = adaptPostResponse(makeReel(), IG_REEL_URL);

    expect(result).toMatchObject({
      hasAudio: true,
      audioTitle: "Song Name",
      audioArtist: "Artist Name",
      audioId: "audio-1",
      audioIsOriginal: false,
    });
  });

  it("leaves audio null for an all-image carousel and does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = adaptPostResponse(makeCarousel([makeImageChild()]), IG_POST_URL);

    expect(result).toMatchObject({
      hasAudio: null,
      audioTitle: null,
      audioArtist: null,
      audioId: null,
      audioIsOriginal: null,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns (but does not throw) when a resolved video child has neither audio field", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const media = makeCarousel([
      makeVideoChild({ has_audio: undefined, clips_music_attribution_info: undefined }),
    ]);

    const result = adaptPostResponse(media, IG_POST_URL);

    expect(result.hasAudio).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("[ADAPTER] Carousel video child resolved");
  });

  it("does not warn when the video child carries has_audio but no music info", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const media = makeCarousel([
      makeVideoChild({ has_audio: false, clips_music_attribution_info: undefined }),
    ]);

    const result = adaptPostResponse(media, IG_POST_URL);

    expect(result.hasAudio).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("adaptPostResponse — nullable booleans must never coerce to false", () => {
  it("maps an absent has_audio to null, not false", () => {
    const result = adaptPostResponse(makeReel({ has_audio: undefined }), IG_REEL_URL);

    expect(result.hasAudio).toBeNull();
    expect(result.hasAudio).not.toBe(false);
  });

  it("maps an absent uses_original_audio to null, not false", () => {
    const media = makeReel({
      clips_music_attribution_info: { song_name: "Song Name" },
    });

    const result = adaptPostResponse(media, IG_REEL_URL);

    expect(result.audioIsOriginal).toBeNull();
    expect(result.audioIsOriginal).not.toBe(false);
  });

  it("preserves an explicit false rather than nulling it", () => {
    const result = adaptPostResponse(makeReel({ has_audio: false }), IG_REEL_URL);

    expect(result.hasAudio).toBe(false);
  });

  it("maps non-boolean truthy/falsy values to null rather than coercing", () => {
    const truthyString = adaptPostResponse(
      makeReel({ has_audio: "true" as unknown as boolean }),
      IG_REEL_URL,
    );
    const zero = adaptPostResponse(makeReel({ has_audio: 0 as unknown as boolean }), IG_REEL_URL);

    expect(truthyString.hasAudio).toBeNull();
    expect(zero.hasAudio).toBeNull();
  });
});

describe("adaptPostResponse — counts, dates, dimensions, duration", () => {
  it("maps the scalar fields of a reel end to end", () => {
    const result = adaptPostResponse(makeReel(), IG_REEL_URL);

    expect(result).toEqual({
      url: IG_REEL_URL,
      shortcode: "ABC123def",
      mediaType: "reel",
      username: "somecreator",
      caption: "caption text",
      viewCount: 12_345,
      postDate: "2023-11-14T22:13:20.000Z",
      durationSec: 18.5,
      thumbnailUrl: "https://cdn.example/reel-thumb.jpg",
      videoUrl: "https://cdn.example/reel.mp4",
      likeCount: 900,
      commentCount: 42,
      hasAudio: true,
      audioTitle: "Song Name",
      audioArtist: "Artist Name",
      audioId: "audio-1",
      audioIsOriginal: false,
      originalWidth: 1080,
      originalHeight: 1920,
      carouselItemCount: null,
      externalId: "owner-1",
    });
  });

  it("returns a null duration for an all-image carousel", () => {
    expect(adaptPostResponse(makeCarousel([makeImageChild()]), IG_POST_URL).durationSec).toBeNull();
  });

  it("accepts numeric strings for numbers and rejects blanks", () => {
    const media = makeReel({
      video_view_count: "42" as unknown as number,
      video_duration: "" as unknown as number,
      dimensions: { width: "1080" as unknown as number, height: undefined },
    });

    const result = adaptPostResponse(media, IG_REEL_URL);

    expect(result.viewCount).toBe(42);
    expect(result.durationSec).toBeNull();
    expect(result.originalWidth).toBe(1080);
    expect(result.originalHeight).toBeNull();
  });

  it("rejects a non-finite view count", () => {
    const media = makeReel({ video_view_count: Number.NaN });

    expect(adaptPostResponse(media, IG_REEL_URL).viewCount).toBeNull();
  });

  it("converts taken_at_timestamp from unix seconds to ISO 8601 UTC", () => {
    const media = makeReel({ taken_at_timestamp: 0 });

    expect(adaptPostResponse(media, IG_REEL_URL).postDate).toBe("1970-01-01T00:00:00.000Z");
  });

  it("returns a null postDate when taken_at_timestamp is absent", () => {
    const media = makeReel({ taken_at_timestamp: undefined });

    expect(adaptPostResponse(media, IG_REEL_URL).postDate).toBeNull();
  });

  it("returns a null caption when the caption edge list is empty", () => {
    const media = makeReel({ edge_media_to_caption: { edges: [] } });

    expect(adaptPostResponse(media, IG_REEL_URL).caption).toBeNull();
  });
});

describe("adaptPostResponse — identity resolution", () => {
  it("falls back to the URL shortcode when the payload has none", () => {
    const media = makeReel({ shortcode: undefined });

    expect(adaptPostResponse(media, IG_REEL_URL).shortcode).toBe("ABC123def");
  });

  it("falls back to an empty shortcode when neither payload nor URL supplies one", () => {
    const media = makeReel({ shortcode: undefined });

    expect(
      adaptPostResponse(media, "https://www.instagram.com/somecreator/tv/ABC/").shortcode,
    ).toBe("");
  });

  it("falls back to the URL username when the owner block has none", () => {
    const media = makeReel({ owner: { id: "owner-1" } });

    expect(adaptPostResponse(media, IG_REEL_URL).username).toBe("somecreator");
  });

  it("throws when no username is resolvable from either the payload or the URL", () => {
    const media = makeReel({ owner: undefined });

    expect(() => adaptPostResponse(media, "https://www.instagram.com/reel/ABC123def/")).toThrow(
      /has no resolvable username/,
    );
  });

  it("maps an absent owner id to a null externalId", () => {
    const media = makeReel({ owner: { username: "somecreator" } });

    expect(adaptPostResponse(media, IG_REEL_URL).externalId).toBeNull();
  });
});

describe("extractOwnerProfile", () => {
  it("maps a full owner block", () => {
    const media = makeReel({
      owner: {
        id: "owner-1",
        username: "somecreator",
        full_name: "Some Creator",
        profile_pic_url: "https://cdn.example/pfp.jpg",
        biography: "bio",
        is_verified: true,
        is_business_account: false,
        is_private: false,
        edge_followed_by: { count: 1000 },
        edge_follow: { count: 50 },
      },
    });

    expect(extractOwnerProfile(media)).toEqual({
      username: "somecreator",
      externalId: "owner-1",
      followerCount: 1000,
      followingCount: 50,
      fullName: "Some Creator",
      profilePicUrl: "https://cdn.example/pfp.jpg",
      biography: "bio",
      isVerified: true,
      isBusinessAccount: false,
      isPrivate: false,
    });
  });

  it("returns null when there is no owner block", () => {
    expect(extractOwnerProfile(makeReel({ owner: undefined }))).toBeNull();
  });

  it("returns null when the owner block has no username — it does not fall back to the URL", () => {
    expect(extractOwnerProfile(makeReel({ owner: { id: "owner-1" } }))).toBeNull();
  });

  it("leaves absent owner booleans null rather than false", () => {
    const profile = extractOwnerProfile(makeReel({ owner: { username: "somecreator" } }));

    expect(profile).toMatchObject({
      isVerified: null,
      isBusinessAccount: null,
      isPrivate: null,
      followerCount: null,
      followingCount: null,
    });
  });
});

/**
 * UNVERIFIED — depends on the modelled (not observed) carousel video-child shape.
 *
 * `ScrapeCreatorsCarouselChildNode`'s video fields (`video_url`, `video_duration`, `has_audio`,
 * `clips_music_attribution_info`) have never been observed on a real carousel child — they are
 * modelled by analogy with the top-level `XDTGraphVideo` shape (see
 * `.claude/context/verified-facts.md`, "/v1/instagram/post" §"NOT VERIFIED"). The tests below
 * read like claims about Instagram's real API ("uses the video child's video_url for a
 * carousel", etc.), but they exercise `makeVideoChild()`, a synthetic fixture, not a captured
 * payload. They are grouped in their own describe block, separate from the rest of this file's
 * adapter-branch pins, specifically so nobody mistakes their names for verified API behaviour.
 * Re-verify (and drop this caveat) once a real video-bearing carousel capture lands — tracked
 * against PR #84 and `tests/fixtures/README.md`.
 */
describe("UNVERIFIED — carousel video-child shape (modelled, never observed against a live payload)", () => {
  it("uses the video child's video_url for a carousel", () => {
    const media = makeCarousel([makeImageChild(), makeVideoChild()]);

    expect(adaptPostResponse(media, IG_POST_URL).videoUrl).toBe(
      "https://cdn.example/child-video.mp4",
    );
  });

  it("sources carousel audio from the video child, not the sidecar top level", () => {
    const media = makeCarousel([makeImageChild(), makeVideoChild()], {
      // A sidecar top level never carries these; prove they are not read even if present.
      has_audio: false,
      clips_music_attribution_info: {
        song_name: "Top Level Song",
        artist_name: "Top Level Artist",
        audio_id: "top-level-audio",
        uses_original_audio: false,
      },
    });

    const result = adaptPostResponse(media, IG_POST_URL);

    expect(result).toMatchObject({
      hasAudio: true,
      audioTitle: "Child Song",
      audioArtist: "Child Artist",
      audioId: "child-audio",
      audioIsOriginal: true,
    });
  });

  it("sources a carousel's duration from the same child the video URL came from", () => {
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_duration: 7.25 }),
      makeVideoChild({ id: "later-video", video_duration: 90 }),
    ]);

    expect(adaptPostResponse(media, IG_POST_URL).durationSec).toBe(7.25);
  });
});
