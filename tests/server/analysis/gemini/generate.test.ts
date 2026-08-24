import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";

/**
 * Ticket #66 code review follow-up: `generate.ts` has no test file at all,
 * and the only existing MAX_TOKENS test
 * (`tests/server/analysis/parser/validation.test.ts:95`) exercises the
 * *parser's* fallback behaviour on an already-truncated body — the exact
 * path the `finishReason` guard in `generate.ts` is supposed to prevent
 * from ever being reached.
 *
 * This suite mocks the `@google/genai` SDK directly (no live network call —
 * `tests/setup/blockLiveFetch.ts` would throw on any unstubbed `fetch`
 * anyway) and asserts `analyzeContent()`:
 *   - throws on a non-STOP `finishReason` (MAX_TOKENS, SAFETY) before ever
 *     reading `response.text`, i.e. before a caller could hand a truncated
 *     body to the parser;
 *   - fails CLOSED on a missing/undefined `finishReason` (empty/absent
 *     `candidates`), rather than falling through to parsing.
 */

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => {
  class GoogleGenAI {
    models = { generateContent: generateContentMock };
  }

  enum FinishReason {
    FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED",
    STOP = "STOP",
    MAX_TOKENS = "MAX_TOKENS",
    SAFETY = "SAFETY",
    RECITATION = "RECITATION",
  }

  // Real shape (node_modules/@google/genai/dist/node/index.mjs): `status`
  // is the HTTP status, `message` is `JSON.stringify(errorBody)` — the
  // nested error message (e.g. "No frames to extract...") is a SUBSTRING
  // of `.message`, not the whole string.
  class ApiError extends Error {
    status: number;
    constructor(options: { message: string; status: number }) {
      super(options.message);
      this.name = "ApiError";
      this.status = options.status;
    }
  }

  return { GoogleGenAI, FinishReason, ApiError };
});

vi.mock("@/lib/server/analysis/schema", () => ({
  ANALYSIS_RESPONSE_SCHEMA: {},
}));

async function importAnalyzeContent() {
  const mod = await import("@/lib/server/analysis/gemini/generate");
  return mod.analyzeContent;
}

const dummyParts = [{ inlineData: { mimeType: "image/jpeg", data: "AAAA" } }];

describe("analyzeContent — finishReason guard (ticket #66 code review)", () => {
  afterEach(() => {
    vi.resetModules();
    generateContentMock.mockReset();
  });

  it("throws on finishReason MAX_TOKENS, before response.text is read", async () => {
    const textGetter = vi.fn(() => '{"style":');
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "MAX_TOKENS" }],
      usageMetadata: { candidatesTokenCount: 32000, thoughtsTokenCount: 700 },
      get text() {
        textGetter();
        return this._text;
      },
      _text: '{"style":',
    });

    const analyzeContent = await importAnalyzeContent();

    await expect(analyzeContent(dummyParts, "prompt")).rejects.toThrow(
      /finishReason=MAX_TOKENS/,
    );
    expect(textGetter).not.toHaveBeenCalled();
  });

  it("throws on finishReason SAFETY, before response.text is read", async () => {
    const textGetter = vi.fn(() => "");
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "SAFETY" }],
      usageMetadata: {},
      get text() {
        textGetter();
        return "";
      },
    });

    const analyzeContent = await importAnalyzeContent();

    await expect(analyzeContent(dummyParts, "prompt")).rejects.toThrow(
      /finishReason=SAFETY/,
    );
    expect(textGetter).not.toHaveBeenCalled();
  });

  it("fails closed (throws) when finishReason is missing entirely — empty candidates", async () => {
    const textGetter = vi.fn(() => "{}");
    generateContentMock.mockResolvedValue({
      candidates: [],
      usageMetadata: {},
      get text() {
        textGetter();
        return "{}";
      },
    });

    const analyzeContent = await importAnalyzeContent();

    await expect(analyzeContent(dummyParts, "prompt")).rejects.toThrow(
      /finishReason=undefined/,
    );
    expect(textGetter).not.toHaveBeenCalled();
  });

  it("fails closed (throws) when candidates itself is absent from the response", async () => {
    const textGetter = vi.fn(() => "{}");
    generateContentMock.mockResolvedValue({
      usageMetadata: {},
      get text() {
        textGetter();
        return "{}";
      },
    });

    const analyzeContent = await importAnalyzeContent();

    await expect(analyzeContent(dummyParts, "prompt")).rejects.toThrow(
      /finishReason=undefined/,
    );
    expect(textGetter).not.toHaveBeenCalled();
  });

  it("passes through on finishReason STOP and returns response.text", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "STOP" }],
      usageMetadata: { candidatesTokenCount: 300 },
      text: '{"style":{}}',
    });

    const analyzeContent = await importAnalyzeContent();

    const result = await analyzeContent(dummyParts, "prompt");
    expect(result).toEqual({ text: '{"style":{}}', raw: '{"style":{}}' });
  });
});

/**
 * Ticket #295: the Gemini-native YouTube URL path (`fileData.fileUri`, no
 * `mimeType`) hits a documented 400 ("No frames to extract with given
 * parameters") on very short clips at the default 1.0 fps sampling rate —
 * NOT an access failure, the video was already fetched. `analyzeContent`
 * must retry exactly once with `videoMetadata: { fps: 24 }` added to the
 * offending part, and must NOT retry (or mask) any other error, including
 * a 400 on an Instagram-shaped part (mimeType present) or any non-400
 * error — those must propagate as-is, since they cannot be this specific
 * frame-sampling trap by construction.
 */
describe("analyzeContent — YouTube frame-sampling 400 retry (ticket #295)", () => {
  const bareYoutubePart = [{ fileData: { fileUri: "https://www.youtube.com/shorts/tiny" } }];

  afterEach(() => {
    vi.resetModules();
    generateContentMock.mockReset();
  });

  it("retries once with videoMetadata.fps: 24 after a 'No frames to extract' 400, and returns the retried result", async () => {
    generateContentMock
      .mockRejectedValueOnce(
        new ApiError({
          status: 400,
          message: JSON.stringify({
            error: {
              code: 400,
              message: "No frames to extract with given parameters. Verify fps, start/end time and video duration.",
              status: "INVALID_ARGUMENT",
            },
          }),
        }),
      )
      .mockResolvedValueOnce({
        candidates: [{ finishReason: "STOP" }],
        usageMetadata: { candidatesTokenCount: 300 },
        text: '{"style":{}}',
      });

    const analyzeContent = await importAnalyzeContent();
    const result = await analyzeContent(bareYoutubePart, "prompt");

    expect(result).toEqual({ text: '{"style":{}}', raw: '{"style":{}}' });
    expect(generateContentMock).toHaveBeenCalledTimes(2);

    const secondCallArgs = generateContentMock.mock.calls[1]![0] as { contents: unknown[] };
    expect(secondCallArgs.contents[0]).toEqual({
      fileData: { fileUri: "https://www.youtube.com/shorts/tiny" },
      videoMetadata: { fps: 24 },
    });
  });

  it("does not retry, and rethrows, a 'No frames' 400 when there is no bare fileData part to raise fps on", async () => {
    const uploadedVideoPart = [{ fileData: { fileUri: "files/abc123", mimeType: "video/mp4" } }];
    generateContentMock.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        message: JSON.stringify({ error: { code: 400, message: "No frames to extract", status: "INVALID_ARGUMENT" } }),
      }),
    );

    const analyzeContent = await importAnalyzeContent();

    await expect(analyzeContent(uploadedVideoPart, "prompt")).rejects.toThrow(/No frames to extract/);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a different 400 (e.g. a genuinely unavailable/private video) — propagates immediately", async () => {
    generateContentMock.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        message: JSON.stringify({ error: { code: 400, message: "Video not accessible", status: "INVALID_ARGUMENT" } }),
      }),
    );

    const analyzeContent = await importAnalyzeContent();

    await expect(analyzeContent(bareYoutubePart, "prompt")).rejects.toThrow(/Video not accessible/);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-ApiError, non-400 failure", async () => {
    generateContentMock.mockRejectedValueOnce(new Error("network timeout"));

    const analyzeContent = await importAnalyzeContent();

    await expect(analyzeContent(bareYoutubePart, "prompt")).rejects.toThrow(/network timeout/);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });
});
