import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { IMAGE_PROXY_CACHE_DIR } from "@/lib/server/imageProxyCache/constants";
import { isStale } from "@/lib/server/imageProxyCache/helpers";
import type { ImageProxyCacheEntry, ImageProxyCacheMeta } from "@/lib/server/imageProxyCache/types";

// Cache filenames are derived only from `sha256(url)`, never from raw user
// input, so a malicious `url` query param can't be used for path traversal
// against the cache directory.
function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function bytesPath(key: string): string {
  return path.join(IMAGE_PROXY_CACHE_DIR, `${key}.bin`);
}

function metaPath(key: string): string {
  return path.join(IMAGE_PROXY_CACHE_DIR, `${key}.json`);
}

/**
 * Reads a cached entry for `url`. Returns `null` on a missing entry,
 * corrupt/unreadable entry, or an entry older than
 * `IMAGE_PROXY_CACHE_TTL_DAYS` — every failure mode here degrades to a
 * cache miss, never to a thrown error, so the caller can always fall back
 * to fetching upstream.
 */
export async function readCacheEntry(url: string): Promise<ImageProxyCacheEntry | null> {
  const key = cacheKey(url);

  try {
    const rawMeta = await fs.promises.readFile(metaPath(key), "utf-8");
    const meta = JSON.parse(rawMeta) as Partial<ImageProxyCacheMeta>;

    if (typeof meta.contentType !== "string" || typeof meta.fetchedAt !== "string") {
      return null;
    }

    if (isStale(meta.fetchedAt)) {
      return null;
    }

    const bytes = await fs.promises.readFile(bytesPath(key));
    return { bytes, contentType: meta.contentType };
  } catch {
    // Missing file, unreadable file, or corrupt JSON — all treated as a
    // plain cache miss.
    return null;
  }
}

/**
 * Writes bytes + content-type to disk for `url`, keyed by `sha256(url)`.
 * Best-effort: any fs error is swallowed (and logged) rather than thrown,
 * since a cache-write failure must never fail the response already being
 * served to the client.
 *
 * NOTE: no eviction/LRU/size-cap here by design (out of scope for this
 * ticket) — unbounded disk growth under `IMAGE_PROXY_CACHE_DIR` is a known,
 * flagged follow-up (candidate fix: periodic prune-by-mtime, or a
 * max-entry-count cap), not solved here.
 */
export async function writeCacheEntry(url: string, bytes: Buffer, contentType: string): Promise<void> {
  const key = cacheKey(url);

  try {
    await fs.promises.mkdir(IMAGE_PROXY_CACHE_DIR, { recursive: true });
    await fs.promises.writeFile(bytesPath(key), bytes);

    const meta: ImageProxyCacheMeta = {
      contentType,
      fetchedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(metaPath(key), JSON.stringify(meta));
  } catch (error) {
    console.error(`[ImageProxyCache] Failed to write cache entry for ${url}:`, error);
  }
}
