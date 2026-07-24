import { GoogleGenAI, FinishReason, type Part } from "@google/genai";

import { ANALYSIS_RESPONSE_SCHEMA } from "@/lib/server/analysis/schema";
import type { PreparedGeminiPart } from "@/lib/server/analysis/media";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

/**
 * Ticket #71 Step 4: `analyzeContent(fileUri, prompt)` -> `analyzeContent(parts,
 * prompt)`. Media parts (videos via the File API, images inline as base64)
 * precede the text prompt, in slide order — a carousel's N media parts all
 * go to Gemini in ONE call, not one call per slide.
 */
export async function analyzeContent(
  mediaParts: PreparedGeminiPart[],
  prompt: string,
): Promise<{ text: string; raw: string }> {
  const parts: Part[] = [...mediaParts];

  parts.push({ text: prompt });

  console.log("[GEMINI] Prompt sent:");
  console.log(prompt);

  // TDD §4.2 / PRD §5.1, §5.2: temperature 0 for reproducibility, structured
  // JSON output constrained by ANALYSIS_RESPONSE_SCHEMA (no fence, no prose
  // wrapper), and a raised token budget — thinking tokens are billed out of
  // the same maxOutputTokens budget on gemini-2.5-flash, so a short budget
  // risks MAX_TOKENS truncation before the model finishes "thinking" and
  // starts emitting the JSON body. This has truncated real Gemini calls
  // before; see .claude/context/verified-facts.md for the SDK mechanics
  // (usageMetadata.thoughtsTokenCount is billed against maxOutputTokens).
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: parts,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      maxOutputTokens: 32768,
    },
  });

  // Log on every call, success or failure, so real headroom against the
  // 32768 budget (candidatesTokenCount + thoughtsTokenCount) is measurable
  // rather than guessed at (TDD §4.2, ticket #66).
  console.log("[GEMINI] usageMetadata:", JSON.stringify(response.usageMetadata));

  // gemini-2.5-flash spends thinking tokens out of the same `maxOutputTokens`
  // budget, so a run can stop at MAX_TOKENS with a truncated body. Truncated
  // output is not salvageable — throw here, BEFORE any caller (or this
  // function) attempts to parse the body. This is the PRD §5.4 "loud errors,
  // not invented data" rule applied at the generation boundary.
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason !== undefined && finishReason !== FinishReason.STOP) {
    throw new Error(
      `Gemini generation did not complete: finishReason=${finishReason}`,
    );
  }

  // `text` is a getter on @google/genai (it was a method on the legacy SDK).
  // A missing `()` would silently stringify a function reference, so assert the
  // type at the boundary instead of trusting it.
  const text = response.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Gemini returned no text content");
  }

  console.log("[GEMINI] Response received:");
  console.log(text);

  return { text, raw: text };
}
