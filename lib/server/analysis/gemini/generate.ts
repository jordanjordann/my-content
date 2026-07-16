import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export async function analyzeContent(
  fileUri: string | null,
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

  if (fileUri) {
    parts.push({
      fileData: {
        mimeType: "video/mp4",
        fileUri,
      },
    });
  }

  parts.push({ text: prompt });

  console.log("[GEMINI] Prompt sent:");
  console.log(prompt);

  const result = await model.generateContent(parts);
  const text = result.response.text();

  console.log("[GEMINI] Response received:");
  console.log(text);

  return { text, raw: text };
}
