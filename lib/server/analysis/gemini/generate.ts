import { GoogleGenAI, FinishReason, createPartFromUri, type Part } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

export async function analyzeContent(
  fileUri: string | null,
  prompt: string,
): Promise<{ text: string; raw: string }> {
  const parts: Part[] = [];

  if (fileUri) {
    parts.push(createPartFromUri(fileUri, "video/mp4"));
  }

  parts.push({ text: prompt });

  console.log("[GEMINI] Prompt sent:");
  console.log(prompt);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: parts,
    config: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  // gemini-2.5-flash spends thinking tokens out of the same `maxOutputTokens`
  // budget, so a run can stop at MAX_TOKENS with a truncated body. Truncated
  // output is not salvageable — throw here, before any caller tries to parse it.
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
