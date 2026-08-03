import { afterEach, describe, expect, it, vi } from "vitest";

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

  return { GoogleGenAI, FinishReason };
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
