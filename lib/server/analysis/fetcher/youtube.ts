import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { MediaMetadata } from "@/lib/server/analysis/types";

const execAsync = promisify(exec);

export async function fetchShortMetadata(url: string): Promise<MediaMetadata> {
  const { stdout } = await execAsync(
    `yt-dlp --dump-json --no-download "${url}"`,
  );

  const data = JSON.parse(stdout) as Record<string, unknown>;

  return {
    url,
    shortcode: (data.id as string) ?? "",
    mediaType: "short",
    username: (data.uploader as string) ?? "unknown",
    caption: (data.description as string) ?? (data.title as string) ?? null,
    viewCount: data.view_count ? Number(data.view_count) : null,
    postDate: data.timestamp
      ? new Date(Number(data.timestamp) * 1000).toISOString()
      : (data.upload_date as string) ?? null,
    durationSec: data.duration ? Number(data.duration) : null,
    thumbnailUrl: (data.thumbnail as string) ?? null,
    videoUrl: null,
  };
}

export async function extractVideoUrl(url: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `yt-dlp -g --no-download "${url}"`,
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
