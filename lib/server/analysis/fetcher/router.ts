import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import type { ClassifiedUrl } from "@/lib/server/analysis/classifier";
import { fetchInstagramMetadata } from "./instagram";
import { fetchShortMetadata, extractVideoUrl } from "./youtube";

export interface FetchedMetadata {
  metadata: MediaMetadata;
  /** Always null for YouTube — only Instagram post payloads carry an owner block. */
  ownerHint: OwnerProfileHint | null;
}

/**
 * Fetches metadata for a classified URL. No BrowserContext param —
 * Playwright's browser lifecycle has been removed entirely; Instagram now
 * goes through the ScrapeCreators API (single request, no browser needed).
 */
export async function fetchMetadata(classified: ClassifiedUrl): Promise<FetchedMetadata> {
  if (classified.platform === "youtube") {
    return { metadata: await fetchYoutubeMetadata(classified.url), ownerHint: null };
  }

  return fetchInstagramMetadata(classified.url);
}

async function fetchYoutubeMetadata(url: string): Promise<MediaMetadata> {
  const metadata = await fetchShortMetadata(url);
  const videoUrl = await extractVideoUrl(url);
  return { ...metadata, videoUrl };
}
