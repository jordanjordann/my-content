import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { requestWithSsrfGuard } from "@/lib/server/net/hardenedRequest";
import {
  DOWNLOAD_USER_AGENT,
  DOWNLOAD_REFERER,
  DOWNLOAD_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_VIDEO_BYTES,
} from "@/lib/server/analysis/downloader/constants";

async function deletePartialFile(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch(() => {});
}

/**
 * Streams an already-connected 2xx response to `filePath`, enforcing
 * `MAX_VIDEO_BYTES`. Rejects on overflow, stream error, or write error —
 * always cleaning up any partial file on the reject path.
 */
function streamToFile(response: IncomingMessage, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let bytesReceived = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      response.destroy();
      file.close();
      void deletePartialFile(filePath).finally(() => reject(error));
    };

    response.on("data", (chunk: Buffer) => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_VIDEO_BYTES) {
        fail(new Error(`Download exceeded maximum size of ${MAX_VIDEO_BYTES} bytes`));
      }
    });

    response.on("error", (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });

    file.on("error", (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });

    file.on("finish", () => {
      if (settled) {
        return;
      }
      settled = true;
      file.close();
      resolve();
    });

    response.pipe(file);
  });
}

export async function downloadVideo(videoUrl: string): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(videoUrl);
  } catch {
    throw new Error(`Invalid video URL: ${videoUrl}`);
  }

  const ext = path.extname(parsedUrl.pathname) || ".mp4";
  const filePath = path.join("/tmp", `${randomUUID()}${ext}`);
  const deadlineAt = Date.now() + DOWNLOAD_TIMEOUT_MS;

  let response: IncomingMessage;
  try {
    response = await requestWithSsrfGuard(videoUrl, {
      headers: {
        "User-Agent": DOWNLOAD_USER_AGENT,
        Referer: DOWNLOAD_REFERER,
        Accept: "*/*",
      },
      maxRedirects: MAX_REDIRECTS,
      deadlineAt,
    });
  } catch (error) {
    await deletePartialFile(filePath);
    throw error instanceof Error ? error : new Error(String(error));
  }

  await streamToFile(response, filePath);
  return filePath;
}
