import { GoogleGenAI, FinishReason } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

export const TITLE_TIMEOUT_MS = 15_000;

/**
 * Ticket #243: replaces `summarizeCaptionToTitle` from `lib/server/ollama.ts`
 * (deleted) — same name, same signature, same fail-soft contract, so the
 * pipeline diff is a one-line import change (`pipeline/index.ts:134`'s
 * `generatedTitle ?? metadata.caption ?? null` is untouched).
 *
 * Unlike `generate.ts`'s `analyzeContent`, which fails loudly because it
 * produces the stored judgement, this call produces a display label only —
 * it must NEVER throw. Every failure mode (missing API key, network error,
 * timeout, non-STOP finish reason, empty text) returns `null`, logs, and
 * lets the pipeline fall back to the raw caption.
 *
 * The prompt receives the caption ONLY — no computed block, no
 * ANGKA_ENGAGEMENT, no reach/ratio figures — so there is nothing for the
 * prose guard to check and the guard is deliberately NOT applied here (see
 * ticket #243 "Rulings this ticket settles").
 */
export async function summarizeCaptionToTitle(caption: string): Promise<string | null> {
  if (!caption || caption.trim().length === 0) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TITLE_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: `Buat judul yang ringkas dan menarik dari caption video ini dalam BAHASA INDONESIA (maks 8 kata). Hanya kembalikan judulnya, tidak ada yang lain:\n\n${caption}`,
        },
      ],
      config: {
        temperature: 0,
        // Thinking tokens are billed against maxOutputTokens on
        // gemini-2.5-flash (verified-facts.md:326). Observed
        // thoughtsTokenCount on this repo's live calls: 696, 2313, 2566,
        // 3994 (verified-facts.md:990,1274,1669,1810) — three of those four
        // already exceed the previous 2048 budget. 8192 gives >2x headroom
        // over the highest observed thinking spend (3994), plus room for
        // the short (<=8-word) title itself. On overrun, MAX_TOKENS still
        // fails soft via the finishReason guard below and falls back to the
        // raw caption — this budget only reduces how often that happens.
        maxOutputTokens: 8192,
        abortSignal: controller.signal,
      },
    });

    // Log on every response received (STOP or truncated) so real
    // thinking-token headroom against the 8192 budget is measurable rather
    // than guessed at, mirroring generate.ts:44-47.
    console.log("[GEMINI] title usageMetadata:", JSON.stringify(response.usageMetadata));

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason !== FinishReason.STOP) {
      console.error(`Gemini title generation did not complete: finishReason=${finishReason ?? "undefined"}`);
      return null;
    }

    const text = response.text;
    if (typeof text !== "string" || text.length === 0) {
      return null;
    }

    return sanitizeTitle(text);
  } catch (error) {
    console.error("Gemini title generation failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Hygiene, not a guard (ticket #243) — trims whitespace, strips wrapping
 * quotes and a leading "Title:"-style prefix, and collapses the response to
 * its first line. Returns null if nothing usable remains.
 */
function sanitizeTitle(rawText: string): string | null {
  const unquotedWhole = rawText.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  const firstLine = unquotedWhole.split("\n")[0]?.trim() ?? "";
  const unprefixed = firstLine
    .replace(/^(judul|title)\s*[:\-]\s*/i, "")
    .trim();
  return unprefixed.length > 0 ? unprefixed : null;
}
