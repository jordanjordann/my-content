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

// M-b (PR #299 review round 2): this used to be a hand-copied twin of
// `hasVideoModalityEvidence` under a comment falsely claiming "real
// implementation, not a mock" — mutations to the REAL function (in
// `gemini/generate.ts`) left this file green while `generate.test.ts`
// correctly caught them, proving it was a separate, driftable copy.
// `importActual` pulls the real export out of the real module so this file
// actually exercises it, not a maintained-by-hand duplicate.
const { hasVideoModalityEvidence } =
  await vi.importActual<typeof import("@/lib/server/analysis/gemini/generate")>(
    "@/lib/server/analysis/gemini/generate",
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

  it("persists analysis_mode = 'full_video' (earned, final state) and a NULL gemini_file_uri (no File API asset on this path)", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });

    // Owner ruling H1 (2026-08-26): the provisional pre-call write is now
    // 'metadata_only', not 'full_video' — the LAST `analysis_mode` UPDATE is
    // the row's final, earned state, which is what this test asserts.
    const analysisModeUpdateCalls = dbExecute.mock.calls.filter((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("analysis_mode = ?");
    });
    expect(analysisModeUpdateCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = analysisModeUpdateCalls[analysisModeUpdateCalls.length - 1]!;
    const query = lastCall[0] as { sql: string; args: unknown[] };

    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("full_video");

    // gemini_file_uri only appears on the FIRST (metadata) UPDATE — the
    // upgrade UPDATE doesn't touch it.
    const metadataUpdateCall = dbExecute.mock.calls.find((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("gemini_file_uri = ?");
    })!;
    const metadataQuery = metadataUpdateCall[0] as { sql: string; args: unknown[] };
    const metadataPlaceholderIndexBefore = (marker: string): number => {
      const before = metadataQuery.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(metadataQuery.args[metadataPlaceholderIndexBefore("gemini_file_uri = ?")]).toBeNull();
  });

  // H1 (PR #299 review round 2, owner ruling 2026-08-26): the provisional
  // pre-call write must be the honest 'metadata_only' default, not
  // 'full_video' — this makes a killed/errored process (or a concurrent
  // viewer reading the row mid-flight) strand on the truthful mode instead
  // of an unearned claim. Verified directly against the FIRST analysis_mode
  // UPDATE (the one written before analyzeContent() is ever called).
  it("writes the provisional analysis_mode as 'metadata_only' BEFORE calling Gemini — never an unearned 'full_video'", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });

    const analysisModeUpdateCalls = dbExecute.mock.calls.filter((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("analysis_mode = ?");
    });
    expect(analysisModeUpdateCalls.length).toBeGreaterThanOrEqual(1);
    const firstCall = analysisModeUpdateCalls[0]!;
    const query = firstCall[0] as { sql: string; args: unknown[] };
    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("metadata_only");
  });

  // H1: a killed process (not a thrown error — that's the `catch` block's
  // job, covered separately below) never reaches the post-call upgrade.
  // Simulating that by having `analyzeContent` hang forever and asserting
  // only ONE analysis_mode UPDATE ever fires proves the row is left at the
  // honest 'metadata_only' default, not a false 'full_video' claim — the
  // exact "durable orphan" the reviewer flagged.
  it("leaves analysis_mode at the honest 'metadata_only' default if the process never gets past the Gemini call (simulated kill)", async () => {
    // Never resolves — stands in for a killed process: no upgrade, no
    // completion, ever runs past this point.
    analyzeContentMock.mockImplementationOnce(() => new Promise(() => {}));

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    // Deliberately not awaited to completion — we only need the write that
    // happens before the (never-resolving) Gemini call to have landed.
    void runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });
    await vi.waitFor(() => expect(analyzeContentMock).toHaveBeenCalledTimes(1));

    const analysisModeUpdateCalls = dbExecute.mock.calls.filter((call) => {
      const query = call[0] as { sql: string; args: unknown[] };
      return typeof query.sql === "string" && query.sql.includes("analysis_mode = ?");
    });
    expect(analysisModeUpdateCalls).toHaveLength(1);
    const query = analysisModeUpdateCalls[0]![0] as { sql: string; args: unknown[] };
    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("metadata_only");
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

describe("runAnalysis — YouTube analysis_mode is EARNED, not asserted (ticket #295 code review, B2/H1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbExecute.mockClear();
    analyzeContentMock.mockClear();
    preparePartsMock.mockClear();
    fetchMetadataMock.mockClear();
    fetchMetadataMock.mockResolvedValue(buildYoutubeMetadata(YOUTUBE_URL));
  });

  /**
   * H1 (owner ruling, 2026-08-26): after the inversion, the provisional
   * write is already the honest 'metadata_only' — so when Gemini's response
   * carries no VIDEO-modality evidence, there is nothing to correct. If the
   * post-response upgrade gate in `pipeline/index.ts` (the
   * `hasVideoModalityEvidence` check) were ever changed to fire
   * unconditionally, this test fails, because a second, unwarranted
   * analysis_mode UPDATE would appear.
   */
  it("leaves analysis_mode at 'metadata_only' (no upgrade) when Gemini's usageMetadata shows no VIDEO modality", async () => {
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
    // Only ONE UPDATE touches analysis_mode: the pre-call provisional write.
    // No evidence means no upgrade, so no second UPDATE fires.
    expect(analysisModeUpdateCalls).toHaveLength(1);
    const query = analysisModeUpdateCalls[0]![0] as { sql: string; args: unknown[] };
    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("metadata_only");
  });

  /**
   * The detector for B2/H1 itself: if the post-response verification gate in
   * `pipeline/index.ts` (the `hasVideoModalityEvidence` check) were ever
   * deleted, this test fails, because the persisted `analysis_mode` would
   * stay at the provisional 'metadata_only' default even though
   * `usageMetadata` here carries genuine VIDEO-modality evidence — the row
   * would then under-claim rather than over-claim, but still not match what
   * Gemini actually did.
   */
  it("upgrades analysis_mode to 'full_video' when usageMetadata DOES evidence VIDEO modality", async () => {
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
    // Two UPDATEs touch analysis_mode: the pre-call provisional write
    // ('metadata_only', honest default) and the post-verification upgrade
    // ('full_video', earned). The LAST one is what a reader of the table
    // (including #297's untrusted banner) actually sees.
    expect(analysisModeUpdateCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = analysisModeUpdateCalls[analysisModeUpdateCalls.length - 1]!;
    const query = lastCall[0] as { sql: string; args: unknown[] };
    const placeholderIndexBefore = (marker: string): number => {
      const before = query.sql.split(marker)[0] ?? "";
      return (before.match(/\?/g) ?? []).length;
    };
    expect(query.args[placeholderIndexBefore("analysis_mode = ?")]).toBe("full_video");

    // M-a (PR #299 review round 2): `perf_bucket_key`/`analysis_mode`
    // "never disagree" is a load-bearing claim (PR body). Mutation-proved
    // to have no detector before this assertion existed — skipping the
    // `computePerformanceBlock` recompute in the upgrade branch left the
    // suite fully green while `perf_bucket_key` still ended in
    // `:metadata_only` next to a persisted `analysis_mode` of 'full_video'.
    // Asserting the LAST UPDATE's `perf_bucket_key` argument agrees with
    // the corrected mode closes that gap.
    const perfBucketKeyIndex = placeholderIndexBefore("perf_bucket_key = ?");
    expect(query.args[perfBucketKeyIndex]).toMatch(/:full_video$/);
    expect(query.args[perfBucketKeyIndex]).not.toMatch(/:metadata_only$/);
  });
});
