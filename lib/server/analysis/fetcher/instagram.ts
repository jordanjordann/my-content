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

  const metadata = await page.evaluate(() => {
    const result: Record<string, unknown> = {};

    try {
      const scripts = document.querySelectorAll("script[type='application/json']");
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent ?? "{}");
          if (data?.require) {
            for (const entry of data.require) {
              if (entry?.[3]?.__bbox?.result) {
                Object.assign(result, entry[3].__bbox.result);
              }
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    } catch {
      // Fallback to OG tags
    }

    if (!result.shortcode) {
      const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
      if (ogUrl?.content) {
        const parts = ogUrl.content.split("/");
        result.shortcode = parts[parts.length - 2] ?? parts[parts.length - 1];
      }
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
