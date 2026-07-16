import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { MediaMetadata } from "@/lib/server/analysis/types";
import { IG_BASE, COOKIE_PATH } from "@/lib/server/analysis/constants";
import fs from "node:fs/promises";

export async function initBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function loadOrCreateContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });

  try {
    await loadCookies(context);
  } catch {
    await login(context);
  }

  return context;
}

export async function login(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;

  if (!username || !password) {
    throw new Error("INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD are required");
  }

  await page.goto(`${IG_BASE}/accounts/login/`);
  await page.waitForLoadState("networkidle");

  const usernameInput = await page.$('input[name="username"]');
  const passwordInput = await page.$('input[name="password"]');

  if (usernameInput && passwordInput) {
    await usernameInput.fill(username);
    await passwordInput.fill(password);

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForLoadState("networkidle");
    }
  }

  await saveCookies(context);
  await page.close();
}

export async function saveCookies(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  await fs.writeFile(COOKIE_PATH, JSON.stringify(cookies));
}

async function loadCookies(context: BrowserContext): Promise<void> {
  const raw = await fs.readFile(COOKIE_PATH, "utf-8");
  const cookies = JSON.parse(raw) as Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }>;
  await context.addCookies(cookies);
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

export async function extractMetadata(page: Page, url: string): Promise<MediaMetadata> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);

  const metadata = await page.evaluate(() => {
    const result: Record<string, unknown> = {};

    const getMeta = (selector: string) =>
      document.querySelector(selector)?.getAttribute("content") ?? null;

    const applyMedia = (media: Record<string, unknown>) => {
      Object.assign(result, media);

      const captionEdges = media.edge_media_to_caption as
        | { edges?: Array<{ node?: { text?: string } }> }
        | undefined;
      const caption = captionEdges?.edges?.[0]?.node?.text;
      if (caption) result.caption = caption;

      if (media.display_url) result.display_url = media.display_url;
      if (media.thumbnail_src) result.thumbnail_src = media.thumbnail_src;
    };

    try {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const script of scripts) {
        const text = script.textContent ?? "";

        try {
          const data = JSON.parse(text);
          if (data?.require) {
            for (const entry of data.require) {
              const bboxResult = entry?.[3]?.__bbox?.result;
              if (bboxResult) Object.assign(result, bboxResult);
            }
          }
        } catch {
          // Continue to legacy global-state parsing below.
        }

        if (!text.includes("edge_media_to_caption") && !text.includes("shortcode_media")) {
          continue;
        }

        const jsonMatch = text.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});\s*$/m) ??
          text.match(/window\._sharedData\s*=\s*({.+?});\s*$/m);

        if (!jsonMatch?.[1]) continue;

        try {
          const parsed = JSON.parse(jsonMatch[1]);
          const entryData = parsed.entry_data?.PostPage?.[0] ?? parsed.entry_data?.ReelsMedia?.[0];
          const media = entryData?.graphql?.shortcode_media ?? entryData?.graphql?.reels_media?.[0];
          if (media) applyMedia(media);
        } catch {
          // Skip invalid legacy payloads.
        }
      }
    } catch {
      // Fallback to meta tags below.
    }

    const ogUrl = getMeta('meta[property="og:url"]');
    if (!result.shortcode && ogUrl) {
      const parts = ogUrl.split("/").filter(Boolean);
      result.shortcode = parts[parts.length - 1] ?? "";
    }

    const ogTitle = getMeta('meta[property="og:title"]');
    const ogDescription = getMeta('meta[property="og:description"]');
    const ogImage = getMeta('meta[property="og:image"]');
    const twitterImage = getMeta('meta[name="twitter:image"]');

    if (!result.caption && ogTitle) {
      const quotedCaption = ogTitle.match(/:\s*["“](.+?)["”]\s*$/);
      if (quotedCaption?.[1]) result.caption = quotedCaption[1];
    }

    if (!result.caption && ogDescription) {
      const quotedCaption = ogDescription.match(/:\s*["“](.+?)["”]\s*$/);
      if (quotedCaption?.[1]) {
        result.caption = quotedCaption[1];
      } else {
        const parts = ogDescription.split(" · ");
        result.caption = parts.length > 1 ? parts.slice(1).join(" · ") : ogDescription;
      }
    }

    if (!result.thumbnail_src && !result.display_url) {
      result.thumbnail_src = ogImage ?? twitterImage;
    }

    return result;
  });

  const shortcode = (metadata.shortcode as string) ?? extractShortcodeFromUrl(url);
  const mediaType = detectMediaType(metadata);
  const owner = metadata.owner as Record<string, unknown> | undefined;
  const user = metadata.user as Record<string, unknown> | undefined;
  const username = (owner?.username as string) ?? (user?.username as string) ?? extractUsernameFromUrl(url);

  const edgeMediaPreviewLike = metadata.edge_media_preview_like as Record<string, unknown> | undefined;

  return {
    url,
    shortcode,
    mediaType,
    username: username ?? "unknown",
    caption: (metadata.caption as string) ?? (metadata.title as string) ?? null,
    viewCount: metadata.video_view_count
      ? Number(metadata.video_view_count)
      : edgeMediaPreviewLike?.count
        ? Number(edgeMediaPreviewLike.count)
        : null,
    postDate: metadata.taken_at_timestamp
      ? new Date(Number(metadata.taken_at_timestamp) * 1000).toISOString()
      : null,
    durationSec: metadata.video_duration ? Number(metadata.video_duration) : null,
    thumbnailUrl: (metadata.thumbnail_src as string) ??
      (metadata.display_url as string) ??
      null,
    videoUrl: (metadata.video_url as string) ?? null,
  };
}

function extractShortcodeFromUrl(url: string): string {
  const match = url.match(/\/(reel|p)\/([\w-]+)/);
  return match?.[2] ?? "";
}

function extractUsernameFromUrl(url: string): string {
  const match = url.match(/instagram\.com\/[\w-]+\/(?:reel|p)\/[\w-]+/);
  if (match) {
    const parts = match[0].split("/");
    const idx = parts.indexOf("instagram.com");
    if (idx !== -1 && parts[idx + 1]) {
      return parts[idx + 1];
    }
  }
  return "";
}

function detectMediaType(metadata: Record<string, unknown>): "reel" | "post" | "carousel" {
  const typename = metadata.__typename as string | undefined;
  if (typename === "GraphVideo") return "reel";
  if (typename === "GraphSidecar") return "carousel";
  return "post";
}
