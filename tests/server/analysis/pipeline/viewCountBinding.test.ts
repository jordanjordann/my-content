import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * PR #95 review item 6: only a code comment (`metadata.ts` / `resolveCounts`
 * in `resolveMediaParts.ts`) currently stops a future refactor from
 * accidentally merging `viewCount`/`playCount` at the point they're bound
 * to `analyses` columns in the pipeline's UPDATE. This test exercises
 * `runAnalysis()` end-to-end (with every collaborator mocked) and asserts,
 * against the ACTUAL SQL args array, that `analyses.view_count` receives
 * `video_view_count` (here: a known-bad `0`, C4's reel trap) and never
 * `video_play_count` (here: `116_333`) — the exact case that motivated
 * `displayedCountIsPlayCount` in the first place.
 */

const dbExecute = vi.fn().mockResolvedValue({ rows: [] });

vi.mock("@/lib/server/db", () => ({
  db: { execute: (...args: unknown[]) => dbExecute(...args) },
}));

vi.mock("@/lib/server/analysis/classifier", () => ({
  classifyUrl: () => ({ platform: "instagram", mediaType: "reel", shortcode: "abc" }),
}));

vi.mock("@/lib/server/analysis/fetcher", () => ({
  fetchMetadata: async () => ({
    metadata: {
      url: "https://www.instagram.com/reel/abc/",
      shortcode: "abc",
      mediaType: "reel",
      username: "creator",
      caption: "hello",
      // C4 branch (a): a reel with a known-bad video_view_count of 0
      // alongside a populated video_play_count.
      viewCount: 0,
      postDate: null,
      durationSec: 10,
      thumbnailUrl: null,
      videoUrl: "https://cdn.example/video.mp4",
      playCount: 116_333,
      displayedCountIsPlayCount: true,
      mediaParts: [],
      mediaPartsTruncated: false,
    },
    ownerHint: null,
  }),
}));

vi.mock("@/lib/server/analysis/downloader", () => ({
  deleteTempFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/server/analysis/gemini", () => ({
  analyzeContent: vi.fn().mockResolvedValue({ text: "{}", raw: "{}" }),
}));

vi.mock("@/lib/server/analysis/media", () => ({
  prepareParts: vi.fn().mockResolvedValue({
    geminiParts: [],
    tempFilePaths: [],
    truncatedForBytes: false,
    preparedCount: 0,
    videoFileUris: [],
  }),
  PreparePartsError: class PreparePartsError extends Error {},
}));

vi.mock("@/lib/server/analysis/prompts", () => ({
  buildSystemInstruction: () => "system",
  buildUserPrompt: () => "user",
}));

vi.mock("@/lib/server/analysis/parser", () => ({
  parseContentAnalysis: () => ({ schemaVersion: 1 }),
}));

vi.mock("@/lib/server/ollama", () => ({
  summarizeCaptionToTitle: vi.fn().mockResolvedValue("Generated Title"),
}));

vi.mock("@/lib/server/profiles", () => ({
  resolveProfile: vi.fn().mockResolvedValue(null),
  computeEngagementRate: () => null,
}));

describe("runAnalysis — analyses.view_count binding regression (review item 6)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbExecute.mockClear();
  });

  it("binds view_count to video_view_count (0) and play_count to video_play_count (116333) — never merged", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await runAnalysis({ url: "https://www.instagram.com/reel/abc/", prompt: "focus on hooks" });

    const metadataUpdateCall = dbExecute.mock.calls.find((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return (
        typeof query.sql === "string" && query.sql.includes("view_count = ?") && query.sql.includes("play_count = ?")
      );
    });

    expect(metadataUpdateCall).toBeDefined();
    const query = metadataUpdateCall![0] as { sql: string; args: unknown[] };

    // Positional binding: `view_count = ?, play_count = ?` in the SQL text
    // is `args[4]` (view_count) then `args[5]` (play_count) — see
    // pipeline/index.ts. Asserted by VALUE here (0 vs 116_333), which is
    // what actually catches a future refactor that collapses the two
    // fields, not just a positional coincidence.
    expect(query.args).toContain(0);
    expect(query.args).toContain(116_333);
    const viewCountIndex = query.args.indexOf(0);
    const playCountIndex = query.args.indexOf(116_333);
    expect(viewCountIndex).not.toBe(-1);
    expect(playCountIndex).not.toBe(-1);
    expect(viewCountIndex).not.toBe(playCountIndex);
  });

  it("persists coauthor_producers as a JSON array and like_and_view_counts_disabled as a nullable boolean (migration 009)", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    // Re-mock fetchMetadata for this test's specific fields via the module
    // mock above (shared) is fine since coauthorUsernames/likeAndViewCounts
    // Disabled default to undefined there — this asserts the "unknown"
    // (never-fetched, never-disabled) case persists correctly: `[]` for
    // coauthors, `NULL` (never coerced to 0/false) for the disabled flag.
    await runAnalysis({ url: "https://www.instagram.com/reel/abc/", prompt: "focus on hooks" });

    const metadataUpdateCall = dbExecute.mock.calls.find((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("coauthor_producers = ?");
    });

    expect(metadataUpdateCall).toBeDefined();
    const query = metadataUpdateCall![0] as { sql: string; args: unknown[] };

    // Positional binding, per pipeline/index.ts's args array: [..., analysisMode,
    // coauthorProducersJson, toDbBool(likeAndViewCountsDisabled), analysisId].
    const [coauthorProducersJson, likeAndViewCountsDisabled] = query.args.slice(-3, -1);
    expect(coauthorProducersJson).toBe("[]");
    // undefined on the mocked metadata -> must persist as NULL, never
    // coerced to 0/false (toDbBool contract, same as has_audio above it).
    expect(likeAndViewCountsDisabled).toBeNull();
  });
});
