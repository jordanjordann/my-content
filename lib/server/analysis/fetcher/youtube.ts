import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { MediaMetadata } from "@/lib/server/analysis/types";

const execAsync = promisify(exec);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function cleanYouTubeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function fetchShortMetadata(url: string): Promise<MediaMetadata> {
  const cleanUrl = cleanYouTubeUrl(url);

  const { stdout } = await execAsync(
    `yt-dlp --dump-json --skip-download --no-warnings --ignore-no-formats-error --user-agent "${USER_AGENT}" --extractor-args "youtube:player_client=web" --no-playlist "${cleanUrl}"`,
  );

  const data = JSON.parse(stdout) as Record<string, unknown>;

  return {
    url,
    shortcode: (data.id as string) ?? "",
    mediaType: "short",
    username: (data.uploader as string) ?? "unknown",
    caption: (data.description as string) || (data.title as string) || null,
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
    const cleanUrl = cleanYouTubeUrl(url);
    const { stdout } = await execAsync(
      `yt-dlp -g --skip-download --no-warnings --user-agent "${USER_AGENT}" --extractor-args "youtube:player_client=web" --no-playlist -f "best[height<=1080]" "${cleanUrl}"`,
    );
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    console.error("[YouTube] extractVideoUrl failed:", error);
    return null;
  }
}
