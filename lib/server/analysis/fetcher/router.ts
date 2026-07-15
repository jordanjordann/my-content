import type { BrowserContext } from "playwright";
import type { MediaMetadata } from "@/lib/server/analysis/types";
import type { ClassifiedUrl } from "@/lib/server/analysis/classifier";
import { extractMetadata, loadOrCreateContext } from "./instagram";
import { fetchShortMetadata, extractVideoUrl } from "./youtube";

export async function fetchMetadata(
  classified: ClassifiedUrl,
  context?: BrowserContext,
): Promise<MediaMetadata> {
  if (classified.platform === "youtube") {
    return fetchYoutubeMetadata(classified.url);
  }

  return fetchInstagramMetadata(classified.url, context);
}

async function fetchInstagramMetadata(
  url: string,
  context?: BrowserContext,
): Promise<MediaMetadata> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const ctx = context ?? (await loadOrCreateContext(browser));
    const page = await ctx.newPage();
    const metadata = await extractMetadata(page, url);
    await page.close();
    return metadata;
  } finally {
    if (!context) {
      await browser.close();
    }
  }
}

async function fetchYoutubeMetadata(url: string): Promise<MediaMetadata> {
  const metadata = await fetchShortMetadata(url);
  const videoUrl = await extractVideoUrl(url);
  return { ...metadata, videoUrl };
}
