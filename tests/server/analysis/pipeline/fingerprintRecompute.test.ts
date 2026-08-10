import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Ticket #72, Step 7 / verification bullet: force an exception inside the
 * fingerprint service and confirm the analysis still completes
 * successfully — the same "log and swallow" convention resolveProfile()
 * already uses (mirrors tests/server/analysis/pipeline/viewCountBinding.test.ts's
 * mocking approach).
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
      viewCount: 100,
      postDate: null,
      durationSec: 10,
      thumbnailUrl: null,
      videoUrl: "https://cdn.example/video.mp4",
      mediaParts: [],
      mediaPartsTruncated: false,
    },
    ownerHint: null,
    reachResult: { value: null, kind: null, state: "UNKNOWN", derivedFrom: "NONE", laterSlideReach: { usable: false } },
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
  parseContentAnalysis: () => ({ schemaVersion: 2, performance: { performanceScore: null, verdict: "", drivers: [] } }),
}));

vi.mock("@/lib/server/ollama", () => ({
  summarizeCaptionToTitle: vi.fn().mockResolvedValue("Generated Title"),
}));

vi.mock("@/lib/server/profiles", () => ({
  resolveProfile: vi.fn().mockResolvedValue({ id: "profile-1", followerCount: 1000 }),
}));

vi.mock("@/lib/server/fingerprint", () => ({
  recomputeFingerprint: vi.fn().mockRejectedValue(new Error("fingerprint boom")),
}));

describe("runAnalysis — fingerprint recompute failure never fails the analysis (#72, Step 7)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbExecute.mockClear();
  });

  it("completes successfully and returns the analysis result even when recomputeFingerprint throws", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    const result = await runAnalysis({ url: "https://www.instagram.com/reel/abc/", prompt: "focus on hooks" });

    expect(result.analysisId).toBeDefined();
    expect(result.content).toEqual({
      schemaVersion: 2,
      performance: { performanceScore: null, verdict: "", drivers: [] },
    });

    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    expect(recomputeFingerprint).toHaveBeenCalledWith("profile-1");
  });
});
