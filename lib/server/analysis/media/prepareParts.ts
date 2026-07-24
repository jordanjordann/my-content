import fs from "node:fs";
import { downloadVideo, downloadMedia } from "@/lib/server/analysis/downloader";
import { uploadToGemini, pollUntilReady, getMimeType } from "@/lib/server/analysis/gemini";
import { MAX_TOTAL_MEDIA_BYTES } from "./constants";
import type { MediaPart, PreparedGeminiPart, PreparedParts } from "./types";

/**
 * Thrown when preparation fails partway through a multi-part post (e.g.
 * slide 3 of 7 fails to download/upload). Carries every temp file written
 * to disk BEFORE the failure so the caller can still clean all of them up
 * — the whole point of ticket #71's cleanup requirement ("no leftover
 * files after a mid-carousel download failure") would otherwise be defeated
 * by an early throw losing track of files written in earlier loop
 * iterations.
 */
export class PreparePartsError extends Error {
  readonly tempFilePaths: string[];

  constructor(message: string, tempFilePaths: string[], options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PreparePartsError";
    this.tempFilePaths = tempFilePaths;
  }
}

/**
 * Downloads/uploads/inlines every media part, in slide order, and hands back
 * Gemini request parts plus every temp file written to disk so the caller
 * can clean all of them up (ticket #71 Step 4) — including on a
 * mid-carousel partial failure, which the old single-`videoPath` cleanup
 * could not do.
 *
 * Videos go through the Gemini File API (download to `/tmp`, upload, poll
 * until ACTIVE) — there is no inline option for video. Images are
 * downloaded fully into memory and inlined as base64 `inlineData` — the
 * File API's per-file download + upload + poll loop is wasteful for
 * carousel-sized images (a 10-slide carousel would be 10 sequential poll
 * loops for content that fits in the request).
 *
 * `MAX_TOTAL_MEDIA_BYTES` is enforced independently of `MAX_MEDIA_PARTS`
 * (Q3): once the running byte total would exceed it, remaining parts are
 * dropped (in document order) rather than downloaded — `truncatedForBytes`
 * tells the caller (prompts/user.ts) to declare that drop in the slide
 * manifest, same as a `MAX_MEDIA_PARTS` truncation.
 */
export async function prepareParts(parts: MediaPart[]): Promise<PreparedParts> {
  const geminiParts: PreparedGeminiPart[] = [];
  const tempFilePaths: string[] = [];
  const videoFileUris: { uri: string; expiresAt: string }[] = [];
  let bytesUsed = 0;
  let truncatedForBytes = false;

  try {
    for (const part of parts) {
      if (part.kind === "video") {
        // Byte size isn't known before download for a video (no reliable
        // Content-Length guarantee from the CDN), so the aggregate guard is
        // checked against the per-file MAX_VIDEO_BYTES ceiling already
        // enforced inside downloadVideo() plus the running total measured
        // after each download completes.
        const filePath = await downloadVideo(part.url);
        tempFilePaths.push(filePath);

        const stat = await fs.promises.stat(filePath);
        if (bytesUsed + stat.size > MAX_TOTAL_MEDIA_BYTES && geminiParts.length > 0) {
          truncatedForBytes = true;
          break;
        }
        bytesUsed += stat.size;

        const uploaded = await uploadToGemini(filePath);
        await pollUntilReady(uploaded.uri);
        videoFileUris.push(uploaded);
        geminiParts.push({ fileData: { fileUri: uploaded.uri, mimeType: getMimeType(filePath) } });
      } else {
        const remaining = MAX_TOTAL_MEDIA_BYTES - bytesUsed;
        if (remaining <= 0 && geminiParts.length > 0) {
          truncatedForBytes = true;
          break;
        }
        const buffer = await downloadMedia(part.url, { maxBytes: Math.max(remaining, 1) });
        if (bytesUsed + buffer.length > MAX_TOTAL_MEDIA_BYTES && geminiParts.length > 0) {
          truncatedForBytes = true;
          break;
        }
        bytesUsed += buffer.length;

        geminiParts.push({
          inlineData: { mimeType: getMimeType(part.url), data: buffer.toString("base64") },
        });
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PreparePartsError(reason, tempFilePaths, { cause: error });
  }

  return {
    geminiParts,
    tempFilePaths,
    truncatedForBytes,
    preparedCount: geminiParts.length,
    videoFileUris,
  };
}
