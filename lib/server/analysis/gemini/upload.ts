import { GoogleGenAI, FileState } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

export async function uploadToGemini(
  filePath: string,
): Promise<{ uri: string; expiresAt: string }> {
  const uploadedFile = await ai.files.upload({
    file: filePath,
    config: {
      mimeType: getMimeType(filePath),
      displayName: filePath.split("/").pop(),
    },
  });

  // `ai.files.upload` resolves to the `File` object directly — there is no
  // `{ file: ... }` wrapper as there was on the legacy SDK. `File.uri` is
  // output-only and therefore optional in the typings, so fail loudly rather
  // than letting `undefined` travel downstream as a file URI.
  if (!uploadedFile.uri) {
    throw new Error("Gemini file upload returned no file URI");
  }

  const expiresAt = uploadedFile.expirationTime
    ? new Date(uploadedFile.expirationTime).toISOString()
    : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  return {
    uri: uploadedFile.uri,
    expiresAt,
  };
}

export async function pollUntilReady(uri: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    // `ai.files.get` normalises `name` internally (`tFileName`): it accepts a
    // full `https://.../files/<id>` URI, a `files/<id>` resource name, or a
    // bare id. Passing the URI straight through is therefore equivalent to the
    // legacy `uri.split("/").pop()` surgery, and more tolerant.
    const file = await ai.files.get({ name: uri });
    if (file.state === FileState.ACTIVE) {
      return;
    }
    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini file processing failed: ${file.uri ?? uri}`);
    }
    await sleep(2000);
  }
  throw new Error("Gemini file processing timed out");
}

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
