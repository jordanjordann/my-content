import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY ?? "");

export async function uploadToGemini(
  filePath: string,
): Promise<{ uri: string; expiresAt: string }> {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType: getMimeType(filePath),
    displayName: filePath.split("/").pop(),
  });

  const expiresAt = uploadResult.file.expirationTime
    ? new Date(uploadResult.file.expirationTime).toISOString()
    : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  return {
    uri: uploadResult.file.uri,
    expiresAt,
  };
}

export async function pollUntilReady(uri: string, maxAttempts = 30): Promise<void> {
  const fileName = uri.split("/").pop() ?? uri;

  for (let i = 0; i < maxAttempts; i++) {
    const file = await fileManager.getFile(fileName);
    if (file.state === FileState.ACTIVE) {
      return;
    }
    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini file processing failed: ${file.uri}`);
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
