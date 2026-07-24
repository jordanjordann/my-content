import path from "node:path";
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

/**
 * Ticket #71 Step 4: gains jpg/jpeg/png/webp — carousel images are inlined
 * as base64 `inlineData` and Gemini rejects `application/octet-stream`
 * (the previous default) for those. Video extensions are unchanged.
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ticket #71 fix-round B1: `getMimeType(filePath)` above was written for
 * `/tmp/<uuid>.mp4` FILE PATHS and does `filePath.split(".").pop()` — for a
 * real Instagram `display_url` (a CDN URL with a query string), that splits
 * on every `.` in the query string too, e.g.
 * `...&_nc_oc=Q6cZ2gGWxHcoe7LAo...` yields `'com&_nc_cat=107&_nc_oc=...'`,
 * never `jpg`. It fell through to `default:` -> `application/octet-stream`,
 * which Gemini rejects for `inlineData` — every carousel image failed in
 * production.
 *
 * Buffer magic-byte sniffing is used here (rather than only parsing the URL
 * pathname) because it is robust against extensionless CDN URLs too, and the
 * caller already holds the downloaded buffer in memory (`prepareParts.ts`)
 * — no extra I/O required. The URL pathname's extension is still tried as a
 * fallback for the rare case a signature isn't recognised, and `image/jpeg`
 * — Instagram's near-universal image format — is the final fallback so an
 * unrecognised-but-real image is never sent as `application/octet-stream`.
 */
export function getImageMimeType(buffer: Buffer, url: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "image/gif";
  }

  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    switch (ext) {
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".png":
        return "image/png";
      case ".webp":
        return "image/webp";
      case ".gif":
        return "image/gif";
      default:
        break;
    }
  } catch {
    // Invalid URL — fall through to the default below.
  }

  return "image/jpeg";
}
