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

function buildYoutubeMetadata(videoUrl: string | null) {
  return {
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
      videoUrl,
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
  };
}

// M2: a controllable mock (not a fixed async literal) so the
// "no videoUrl at all" case is a `mockResolvedValueOnce` override, not a
// separate `vi.doMock`/`vi.resetModules` dance.
const fetchMetadataMock = vi.fn().mockResolvedValue(buildYoutubeMetadata(YOUTUBE_URL));

vi.mock("@/lib/server/analysis/fetcher", () => ({
  fetchMetadata: (...args: unknown[]) => fetchMetadataMock(...args),
}));

vi.mock("@/lib/server/analysis/downloader", () => ({
  deleteTempFile: vi.fn().mockResolvedValue(undefined),
}));

// Ticket #295 code review, B2: `usageMetadata.promptTokensDetails` carrying a
// VIDEO-modality entry with a positive token count is the mechanical proof
// that Gemini actually decoded the video (the same signal
// docs/audit/ANALYSIS-288-youtube-extraction.md §3's spike captured live —
// `{"modality":"VIDEO","tokenCount":6049}`). Default mock resolution below
// includes this evidence so the existing "persists full_video" test keeps
// asserting the EARNED case, not a pre-call assumption.
const VIDEO_MODALITY_USAGE_METADATA = {
  promptTokensDetails: [
    { modality: "TEXT", tokenCount: 500 },
    { modality: "VIDEO", tokenCount: 6049 },
  ],
};

const analyzeContentMock = vi
  .fn()
  .mockResolvedValue({ text: "{}", raw: "{}", usageMetadata: VIDEO_MODALITY_USAGE_METADATA });

// Real implementation, not a mock: ticket #295 code review B2 is exactly
// about this function's job actually running against whatever
// `analyzeContentMock` resolves with in a given test.
const hasVideoModalityEvidence = (usageMetadata: { promptTokensDetails?: { modality?: string; tokenCount?: number }[] } | undefined) =>
  (usageMetadata?.promptTokensDetails ?? []).some(
    (detail) => detail.modality === "VIDEO" && (detail.tokenCount ?? 0) > 0,
  );

vi.mock("@/lib/server/analysis/gemini", () => ({
  analyzeContent: (...args: unknown[]) => analyzeContentMock(...args),
  hasVideoModalityEvidence,
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
    fetchMetadataMock.mockClear();
    fetchMetadataMock.mockResolvedValue(buildYoutubeMetadata(YOUTUBE_URL));
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

  // M2: the `!metadata.videoUrl` guard had no detector — deleting it
  // entirely left the suite green, because every other test in this file
  // supplies a `videoUrl`. This asserts the guard's actual observable
  // behaviour: no `videoUrl` on the YouTube branch must refuse (and delete
  // the row for a first analysis), never fall through to a metadata-only
  // Gemini call.
  it("M2 detector: refuses when YouTube metadata has no videoUrl at all, before ever calling Gemini", async () => {
    fetchMetadataMock.mockResolvedValueOnce(buildYoutubeMetadata(null));

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await expect(runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" })).rejects.toThrow(
      /missing a video URL/,
    );
    expect(analyzeContentMock).not.toHaveBeenCalled();

    const deleteCall = dbExecute.mock.calls.find((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("DELETE FROM analyses");
    });
    expect(deleteCall).toBeDefined();
  });
});

describe("runAnalysis — YouTube analysis_mode is EARNED, not asserted (ticket #295 code review, B2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbExecute.mockClear();
    analyzeContentMock.mockClear();
    preparePartsMock.mockClear();
    fetchMetadataMock.mockClear();
    fetchMetadataMock.mockResolvedValue(buildYoutubeMetadata(YOUTUBE_URL));
  });

  /**
   * The detector for B2 itself: if the post-response verification gate in
   * `pipeline/index.ts` (the `hasVideoModalityEvidence` check) were ever
   * deleted, this test fails, because the persisted `analysis_mode` would
   * revert to the old, unconditional 'full_video' assertion even though
   * `usageMetadata` here carries NO `VIDEO` modality entry at all — the
   * exact "Gemini answered without decoding the media" case B2 is about.
   */
  it("downgrades analysis_mode to 'metadata_only' when Gemini's usageMetadata shows no VIDEO modality", async () => {
    analyzeContentMock.mockResolvedValueOnce({
      text: "{}",
      raw: "{}",
      usageMetadata: { promptTokensDetails: [{ modality: "TEXT", tokenCount: 500 }] },
    });

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });

    const analysisModeUpdateCalls = dbExecute.mock.calls.filter((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("analysis_mode = ?");
    });
    // Two UPDATEs touch analysis_mode: the pre-call provisional write
    // ('full_video', intent) and the post-verification correction
    // ('metadata_only', earned). The LAST one is what a reader of the table
    // (including #297's untrusted banner) actually sees.
    expect(analysisModeUpdateCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = analysisModeUpdateCalls[analysisModeUpdateCalls.length - 1]!;
    const query = lastCall[0] as { sql: string; args: unknown[] };
    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("metadata_only");
  });

  it("keeps analysis_mode = 'full_video' when usageMetadata DOES evidence VIDEO modality", async () => {
    analyzeContentMock.mockResolvedValueOnce({
      text: "{}",
      raw: "{}",
      usageMetadata: {
        promptTokensDetails: [
          { modality: "TEXT", tokenCount: 500 },
          { modality: "VIDEO", tokenCount: 6049 },
        ],
      },
    });

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });

    const analysisModeUpdateCalls = dbExecute.mock.calls.filter((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("analysis_mode = ?");
    });
    const lastCall = analysisModeUpdateCalls[analysisModeUpdateCalls.length - 1]!;
    const query = lastCall[0] as { sql: string; args: unknown[] };
    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("full_video");
  });
});
