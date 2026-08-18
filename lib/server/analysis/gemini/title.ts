import { GoogleGenAI, FinishReason } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const TITLE_TIMEOUT_MS = 15_000;

/**
 * Ticket #243: replaces `summarizeCaptionToTitle` from `lib/server/ollama.ts`
 * (deleted) — same name, same signature, same fail-soft contract, so the
 * pipeline diff is a one-line import change (`pipeline/index.ts:135`'s
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
        maxOutputTokens: 2048,
        abortSignal: controller.signal,
      },
    });

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
