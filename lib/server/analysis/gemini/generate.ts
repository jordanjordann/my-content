import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export async function analyzeContent(
  fileUris: string[],
  metadata: { caption: string | null; durationSec: number | null }[],
  prompt: string,
): Promise<{ text: string; raw: string }> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  const parts: Array<{ text: string } | { fileData: { mimeType: string; fileUri: string } }> =
    [];

  for (const uri of fileUris) {
    parts.push({
      fileData: {
        mimeType: "video/mp4",
        fileUri: uri,
      },
    });
  }

  parts.push({ text: prompt });

  const result = await model.generateContent(parts);
  const text = result.response.text();

  return { text, raw: text };
}
