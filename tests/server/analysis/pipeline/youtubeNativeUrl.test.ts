import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Ticket #295 (#288): on the YouTube branch, `runAnalysis()` must build the
 * Gemini media part directly from `metadata.videoUrl` as a bare
 * `fileData.fileUri` part (mimeType omitted) — no `prepareParts()` call, no
 * download, no File API upload — and must NOT rewrite/strip the URL.
 *
 * Also asserts #292's refusal guarantee survives structurally: when
 * `analyzeContent` throws (the new stand-in for "Gemini could not obtain
 * the video", now that there is no free local pre-check), `runAnalysis`
 * still deletes the row for a first-time analysis rather than persisting a
 * caption-only result.
 */

const dbExecute = vi.fn().mockResolvedValue({ rows: [] });

vi.mock("@/lib/server/db", () => ({
  db: { execute: (...args: unknown[]) => dbExecute(...args) },
}));

vi.mock("@/lib/server/analysis/classifier", () => ({
  classifyUrl: () => ({ platform: "youtube", mediaType: "short", shortcode: "abc123" }),
}));

const YOUTUBE_URL = "https://www.youtube.com/shorts/abc123";

vi.mock("@/lib/server/analysis/fetcher", () => ({
  fetchMetadata: async () => ({
    metadata: {
      url: YOUTUBE_URL,
      shortcode: "abc123",
      mediaType: "short",
      username: "creator",
      caption: "hello",
      viewCount: 1000,
      postDate: null,
      durationSec: 12,
      thumbnailUrl: null,
      // The exact, unmodified public URL — ticket #295's fetcher/router.ts
      // no longer downloads or rewrites it.
      videoUrl: YOUTUBE_URL,
    },
    ownerHint: null,
    reachResult: {
      value: 1000,
      kind: "VIEWS",
      state: "AVAILABLE",
      derivedFrom: "TOP_LEVEL",
      laterSlideReach: { usable: false },
      hasVideo: true,
    },
  }),
}));

vi.mock("@/lib/server/analysis/downloader", () => ({
  deleteTempFile: vi.fn().mockResolvedValue(undefined),
}));

const analyzeContentMock = vi.fn().mockResolvedValue({ text: "{}", raw: "{}" });

vi.mock("@/lib/server/analysis/gemini", () => ({
  analyzeContent: (...args: unknown[]) => analyzeContentMock(...args),
  summarizeCaptionToTitle: vi.fn().mockResolvedValue("Generated Title"),
}));

// Never called on the YouTube branch — asserted explicitly below.
const preparePartsMock = vi.fn();

vi.mock("@/lib/server/analysis/media", () => ({
  prepareParts: (...args: unknown[]) => preparePartsMock(...args),
  PreparePartsError: class PreparePartsError extends Error {},
}));

vi.mock("@/lib/server/analysis/prompts", () => ({
  buildSystemInstruction: () => "system",
  buildUserPrompt: () => "user",
}));

vi.mock("@/lib/server/analysis/parser", () => ({
  parseContentAnalysis: () => ({ schemaVersion: 1, performance: { performanceScore: null, verdict: "", drivers: [] } }),
}));

vi.mock("@/lib/server/profiles", () => ({
  resolveProfile: vi.fn().mockResolvedValue(null),
}));

describe("runAnalysis — YouTube native Gemini URL input (ticket #295)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbExecute.mockClear();
    analyzeContentMock.mockClear();
    preparePartsMock.mockClear();
  });

  it("sends a bare fileData.fileUri part built from the unmodified videoUrl, and never calls prepareParts", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });

    expect(preparePartsMock).not.toHaveBeenCalled();
    expect(analyzeContentMock).toHaveBeenCalledTimes(1);

    const [geminiParts] = analyzeContentMock.mock.calls[0] as [unknown[], string];
    expect(geminiParts).toEqual([{ fileData: { fileUri: YOUTUBE_URL } }]);
    // No mimeType key at all (not merely undefined) — matches the verified
    // wire shape in .claude/context/verified-facts.md.
    expect(Object.keys((geminiParts[0] as { fileData: object }).fileData)).toEqual(["fileUri"]);
  });

  it("persists analysis_mode = 'full_video' and a NULL gemini_file_uri (no File API asset on this path)", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });

    const metadataUpdateCall = dbExecute.mock.calls.find((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("analysis_mode = ?");
    });
    expect(metadataUpdateCall).toBeDefined();
    const query = metadataUpdateCall![0] as { sql: string; args: unknown[] };

    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("full_video");
    expect(query.args[placeholderIndexBefore("gemini_file_uri = ?")]).toBeNull();
  });

  it("refuses (deletes the row) rather than persisting a caption-only result when Gemini cannot obtain the video", async () => {
    analyzeContentMock.mockRejectedValueOnce(new Error("Gemini could not access this video"));

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await expect(runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" })).rejects.toThrow(
      /could not access this video/,
    );

    const deleteCall = dbExecute.mock.calls.find((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("DELETE FROM analyses");
    });
    expect(deleteCall).toBeDefined();
  });
});
