import ollama from "ollama";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

/**
 * Summarizes a video caption into a concise title using a local Ollama LLM.
 * Returns null if caption is empty or Ollama is unreachable.
 */
export async function summarizeCaptionToTitle(caption: string): Promise<string | null> {
  if (!caption || caption.trim().length === 0) {
    return null;
  }

  try {
    const response = await ollama.generate({
      model: OLLAMA_MODEL,
      prompt: `Buat judul yang ringkas dan menarik dari caption video ini dalam BAHASA INDONESIA (maks 8 kata). Hanya kembalikan judulnya, tidak ada yang lain:\n\n${caption}`,
      stream: false,
      options: {
        temperature: 0.7,
      },
    });

    const title = response.response.trim();
    return title.length > 0 ? title : null;
  } catch (error) {
    console.error("Ollama title generation failed:", error);
    return null;
  }
}
