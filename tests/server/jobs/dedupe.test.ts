import { describe, expect, it } from "vitest";

import { normaliseAnalysisUrl } from "@/lib/server/analysis/classifier/rules";
import { buildDedupeKey, hashPrompt } from "@/lib/server/jobs/dedupe";

/**
 * Ticket #352 (3A-M1b). Pure-function tests, no DB. Uses the real
 * `normaliseAnalysisUrl()` (#350) rather than hand-rolled strings, so
 * dedupe-key collapsing is proven against the actual URL variants #286's
 * differential table names.
 */

describe("hashPrompt", () => {
  it("is stable for the same input", () => {
    expect(hashPrompt("analyse the hook")).toEqual(hashPrompt("analyse the hook"));
  });

  it("differs for different prompts", () => {
    expect(hashPrompt("prompt A")).not.toEqual(hashPrompt("prompt B"));
  });

  // An empty prompt is a real, distinct input -- not a sentinel/no-prompt
  // case. MUTATION: if hashPrompt ever special-cased "" to a fixed
  // placeholder shared with some other input, this would collapse two
  // distinct dedupe keys into one.
  it("hashes an empty prompt to a real, non-empty digest distinct from other prompts", () => {
    const emptyHash = hashPrompt("");
    expect(emptyHash.length).toBeGreaterThan(0);
    expect(emptyHash).not.toEqual(hashPrompt("a"));
  });
});

describe("buildDedupeKey", () => {
  const promptHash = hashPrompt("analyse the hook");

  it("collapses real URL variants (trailing slash, utm_source, igsh) to one key", () => {
    const variants = [
      "https://www.instagram.com/reel/ABC123",
      "https://www.instagram.com/reel/ABC123/",
      "https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link",
      "https://instagram.com/reel/ABC123?igsh=xyz",
    ];

    const keys = variants.map((url) => {
      const normalised = normaliseAnalysisUrl(url);
      if (!normalised) {
        throw new Error(`test setup: expected ${url} to normalise`);
      }
      return buildDedupeKey(normalised, promptHash);
    });

    expect(new Set(keys).size).toEqual(1);
  });

  it("produces different keys for different prompts on the same URL", () => {
    const normalised = normaliseAnalysisUrl("https://www.instagram.com/reel/ABC123");
    if (!normalised) {
      throw new Error("test setup: expected URL to normalise");
    }

    const keyA = buildDedupeKey(normalised, hashPrompt("prompt A"));
    const keyB = buildDedupeKey(normalised, hashPrompt("prompt B"));

    expect(keyA).not.toEqual(keyB);
  });

  it("produces different keys for different normalised URLs with the same prompt", () => {
    const normalisedA = normaliseAnalysisUrl("https://www.instagram.com/reel/ABC123");
    const normalisedB = normaliseAnalysisUrl("https://www.instagram.com/reel/XYZ789");
    if (!normalisedA || !normalisedB) {
      throw new Error("test setup: expected both URLs to normalise");
    }

    expect(buildDedupeKey(normalisedA, promptHash)).not.toEqual(buildDedupeKey(normalisedB, promptHash));
  });
});
