import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Ticket #243: `summarizeCaptionToTitle` replaces the Ollama version and
 * must preserve its fail-soft contract exactly — it must NEVER throw, and
 * every failure mode (SDK rejection, non-STOP finishReason, empty text,
 * timeout/abort) resolves to `null` so the pipeline falls back to the raw
 * caption (`pipeline/index.ts:135`, unchanged by this ticket).
 *
 * Mocks the `@google/genai` SDK directly — no live network call
 * (`tests/setup/blockLiveFetch.ts` would throw on any unstubbed `fetch`
 * anyway).
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

async function importSummarizeCaptionToTitle() {
  const mod = await import("@/lib/server/analysis/gemini/title");
  return mod.summarizeCaptionToTitle;
}

async function importTitleTimeoutMs() {
  const mod = await import("@/lib/server/analysis/gemini/title");
  return mod.TITLE_TIMEOUT_MS;
}

describe("summarizeCaptionToTitle — fail-soft contract (ticket #243)", () => {
  afterEach(() => {
    vi.resetModules();
    generateContentMock.mockReset();
  });

  it("returns null and never calls the SDK for an empty caption", async () => {
    const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

    const result = await summarizeCaptionToTitle("");

    expect(result).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("returns null and never calls the SDK for a whitespace-only caption", async () => {
    const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

    const result = await summarizeCaptionToTitle("   \n  ");

    expect(result).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("resolves to null, does not throw, when the SDK rejects", async () => {
    generateContentMock.mockRejectedValue(new Error("network boom"));
    const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

    await expect(summarizeCaptionToTitle("a real caption")).resolves.toBeNull();
  });

  it("resolves to null on a non-STOP finishReason, does not throw", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "MAX_TOKENS" }],
      get text() {
        return "should not be read";
      },
    });
    const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

    await expect(summarizeCaptionToTitle("a real caption")).resolves.toBeNull();
  });

  it("resolves to null on empty text with STOP finishReason", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "STOP" }],
      text: "",
    });
    const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

    await expect(summarizeCaptionToTitle("a real caption")).resolves.toBeNull();
  });

  it("resolves to null on undefined text with STOP finishReason — the shape the SDK actually emits (verified-facts.md:311: the `text` getter returns `undefined` when there are no text parts)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      generateContentMock.mockResolvedValue({
        candidates: [{ finishReason: "STOP" }],
        text: undefined,
      });
      const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

      await expect(summarizeCaptionToTitle("a real caption")).resolves.toBeNull();

      // The `typeof text !== "string"` guard must return null directly and
      // silently. If the guard is removed, `undefined` reaches
      // `sanitizeTitle`, throws a TypeError on `.trim()`, and is swallowed
      // by the outer catch, which DOES log via console.error — so this
      // assertion distinguishes "handled by the guard" from "handled by
      // accident via the catch block".
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("resolves to null when the request aborts (timeout path)", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock.mockImplementation((params: { config?: { abortSignal?: AbortSignal } }) => {
        return new Promise((_resolve, reject) => {
          params.config?.abortSignal?.addEventListener("abort", () => {
            reject(new Error("This operation was aborted"));
          });
        });
      });
      const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

      const promise = summarizeCaptionToTitle("a real caption");

      // Advance past the module's internal 15s timeout, which fires
      // controller.abort() and, per the mock above, rejects the SDK call.
      await vi.advanceTimersByTimeAsync(15_000);

      await expect(promise).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pins the timeout at exactly TITLE_TIMEOUT_MS (15s), not merely some value <=15s", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      generateContentMock.mockImplementation((params: { config?: { abortSignal?: AbortSignal } }) => {
        return new Promise((_resolve, reject) => {
          params.config?.abortSignal?.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("This operation was aborted"));
          });
        });
      });
      const TITLE_TIMEOUT_MS = await importTitleTimeoutMs();
      expect(TITLE_TIMEOUT_MS).toBe(15_000);

      const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();
      const promise = summarizeCaptionToTitle("a real caption");
      // Suppress unhandled rejection warnings until the abort actually fires.
      promise.catch(() => {});

      // One tick before the boundary: must NOT have aborted yet.
      await vi.advanceTimersByTimeAsync(TITLE_TIMEOUT_MS - 1);
      expect(aborted).toBe(false);

      // Crossing the boundary: must abort exactly here.
      await vi.advanceTimersByTimeAsync(1);
      expect(aborted).toBe(true);

      await expect(promise).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sanitises a well-formed response: trims, unquotes, strips a Title: prefix, keeps first line only", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "STOP" }],
      text: '"Judul: Cara Cepat Belajar\nbaris kedua"',
    });
    const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

    const result = await summarizeCaptionToTitle("caption asli");

    expect(result).toBe("Cara Cepat Belajar");
  });

  it("sends only the caption text — no computed block, no schema, no JSON response config", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "STOP" }],
      text: "Judul Singkat",
    });
    const summarizeCaptionToTitle = await importSummarizeCaptionToTitle();

    await summarizeCaptionToTitle("caption asli");

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const callArg = generateContentMock.mock.calls[0][0];
    expect(callArg.model).toBe("gemini-2.5-flash");
    expect(callArg.config.responseSchema).toBeUndefined();
    expect(callArg.config.responseMimeType).toBeUndefined();
    expect(callArg.config.temperature).toBe(0);
    const promptText = callArg.contents[0].text as string;
    expect(promptText).toContain("caption asli");
  });
});
