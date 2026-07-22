import { describe, expect, it } from "vitest";

import type {
  ScrapeCreatorsYoutubeChannel,
  ScrapeCreatorsYoutubeVideo,
} from "@/lib/server/scrapecreators/types";
import { loadJsonFixture, YOUTUBE_FIXTURES } from "@/tests/helpers/fixtures";

/**
 * Golden-file pins over the **real** ScrapeCreators YouTube captures in
 * `.claude/context/fixtures/scrapecreators-youtube/` (10 payloads, captured
 * live 2026-07-21 under ticket #53 / PR #63).
 *
 * These assert the facts recorded in `.claude/context/verified-facts.md`
 * against the payloads those facts were derived from, so that:
 *   1. the fixtures cannot silently rot or be replaced by hand-edited copies,
 *   2. the traps documented in `types.ts` (`durationMs` is milliseconds,
 *      `publishDate` is ISO-with-offset not unix seconds, `avatar` is an
 *      object, `banner` is an array, a not-found channel body says
 *      `success: true`) stay pinned by an executable test rather than only
 *      by a comment, and
 *   3. #54's YouTube fetcher has something to build against without spending
 *      credits.
 *
 * Deliberately offline: no `scRequest` call, no network, no credits.
 */

const video = loadJsonFixture<ScrapeCreatorsYoutubeVideo>(YOUTUBE_FIXTURES.videoFresh);
const videoTrim = loadJsonFixture<ScrapeCreatorsYoutubeVideo>(YOUTUBE_FIXTURES.videoTrim);
const short = loadJsonFixture<ScrapeCreatorsYoutubeVideo>(YOUTUBE_FIXTURES.short);
const channel = loadJsonFixture<ScrapeCreatorsYoutubeChannel>(YOUTUBE_FIXTURES.channelHandle);
const channelAtHandle = loadJsonFixture<ScrapeCreatorsYoutubeChannel>(
  YOUTUBE_FIXTURES.channelAtHandle,
);
const channelTrim = loadJsonFixture<ScrapeCreatorsYoutubeChannel>(YOUTUBE_FIXTURES.channelTrim);

describe("/v1/youtube/video — envelope", () => {
  it("is flat: no `data` wrapper to unwrap", () => {
    expect(video).not.toHaveProperty("data");
    expect(video.id).toBe("tPEE9ZwTmy0");
    expect(video.type).toBe("video");
    expect(video.success).toBe(true);
  });

  it("carries credits_remaining, which the client currently discards", () => {
    expect(typeof video.credits_remaining).toBe("number");
  });
});

describe("/v1/youtube/video — the fields that are easy to get wrong", () => {
  it("expresses duration in MILLISECONDS", () => {
    expect(video.durationMs).toBe(1000);
    expect(video.durationFormatted).toBe("00:00:01");
  });

  it("returns publishDate as ISO-8601 with an offset, not unix seconds", () => {
    expect(video.publishDate).toBe("2011-01-19T09:40:47-08:00");
    expect(typeof video.publishDate).toBe("string");
    expect(Number.isNaN(Date.parse(video.publishDate as string))).toBe(false);
  });

  it("returns comma-formatted *Text counts that must not be parsed as numbers", () => {
    expect(video.viewCountText).toContain(",");
    expect(Number(video.viewCountText)).toBeNaN();
    expect(typeof video.viewCountInt).toBe("number");
  });

  it("exposes the channel handle WITHOUT a leading @ and the id with UC", () => {
    expect(video.channel?.handle).toBe("hiddentracktv2");
    expect(video.channel?.handle?.startsWith("@")).toBe(false);
    expect(video.channel?.id?.startsWith("UC")).toBe(true);
    expect(video.channel?.url).toContain("/@hiddentracktv2");
  });

  it("cannot be used as a download source — downloadOptions.formats is empty", () => {
    expect(video.downloadOptions?.formats).toEqual([]);
    expect(video.downloadOptions?.hlsManifestUrl).toBeNull();
    expect(video.downloadOptions?.dashManifestUrl).toBeNull();
  });

  it("carries watchNextVideos, which is recommendation data and must not be persisted", () => {
    expect(Array.isArray(video.watchNextVideos)).toBe(true);
  });

  it("has the same top-level key set for a Short as for a regular video request", () => {
    expect(Object.keys(short).sort()).toEqual(Object.keys(video).sort());
  });
});

describe("/v1/youtube/video — trim has no effect", () => {
  it("returns an identical top-level key set with and without trim", () => {
    expect(Object.keys(videoTrim).sort()).toEqual(Object.keys(video).sort());
  });

  it("keeps captionTracks and downloadOptions under trim", () => {
    expect(videoTrim).toHaveProperty("captionTracks");
    expect(videoTrim).toHaveProperty("downloadOptions");
  });
});

describe("/v1/youtube/video — not-found body", () => {
  it("reports success: false with a not_found error (HTTP 404 on the wire)", () => {
    const deleted = loadJsonFixture<Record<string, unknown>>(YOUTUBE_FIXTURES.videoDeleted);

    expect(deleted).toMatchObject({
      success: false,
      error: "not_found",
      errorStatus: 404,
      message: "Video unavailable",
    });
  });
});

describe("/v1/youtube/channel — envelope and shape", () => {
  it("is flat, like the video endpoint", () => {
    expect(channel).not.toHaveProperty("data");
  });

  it("confirms subscriberCount is a real number (#57 depends on this)", () => {
    expect(typeof channel.subscriberCount).toBe("number");
    expect(channel.subscriberCount).toBe(268000);
    expect(Number(channel.subscriberCountText)).toBeNaN();
  });

  it("echoes the handle WITH a leading @, unlike the video payload's channel.handle", () => {
    expect(channel.handle).toBe("@hiddentracktv2");
    expect(channel.channelId).toBe("UC9kN-ROrTY81zH856AxXuGQ");
  });

  it("returns tags as a comma-separated string, not an array", () => {
    expect(typeof channel.tags).toBe("string");
    expect(Array.isArray(channel.tags)).toBe(false);
  });

  it("returns avatar as an object and banner as an array — neither is a string", () => {
    expect(typeof channel.avatar).toBe("object");
    expect(Array.isArray(channel.avatar)).toBe(false);
    expect(channel.avatar?.image?.sources?.[0]).toMatchObject({ width: 68, height: 68 });

    expect(Array.isArray(channel.banner)).toBe(true);
    expect(channel.banner?.length).toBe(6);
    expect(typeof channel.banner?.[0]?.url).toBe("string");
  });

  it("carries arbitrary per-channel social-link keys that fall through the index signature", () => {
    expect(Object.keys(channel)).toEqual(expect.arrayContaining(["instagram", "facebook"]));
  });
});

describe("/v1/youtube/channel — handle formats and trim", () => {
  it("resolves a bare handle and an @-prefixed handle to the same channel", () => {
    expect(channelAtHandle.channelId).toBe(channel.channelId);
    expect(channelAtHandle.name).toBe(channel.name);
    expect(channelAtHandle.subscriberCount).toBe(channel.subscriberCount);
  });

  it("returns an identical top-level key set with and without trim", () => {
    expect(Object.keys(channelTrim).sort()).toEqual(Object.keys(channel).sort());
  });
});

describe("/v1/youtube/channel — not-found bodies lie about success", () => {
  it.each([
    ["UC channel id passed as handle", YOUTUBE_FIXTURES.channelUcid],
    ["UC channel id, repeat capture", YOUTUBE_FIXTURES.channelUcid2],
    ["wholly nonexistent handle", YOUTUBE_FIXTURES.channelBogus],
  ])("%s: body says success: true but is a 404 with accountDoesNotExist", (_label, fixture) => {
    const body = loadJsonFixture<Record<string, unknown>>(fixture);

    expect(body).toMatchObject({
      success: true,
      accountDoesNotExist: true,
      error: "not_found",
      errorStatus: 404,
      userId: null,
    });
    // No channel identity is returned at all — do not try to salvage one.
    expect(body).not.toHaveProperty("channelId");
    expect(body).not.toHaveProperty("subscriberCount");
  });
});
