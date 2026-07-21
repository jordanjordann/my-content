import os from "node:os";
import path from "node:path";

export const IMAGE_PROXY_CACHE_DIR =
  process.env.IMAGE_PROXY_CACHE_DIR || path.join(os.tmpdir(), "image-proxy-cache");

const DEFAULT_IMAGE_PROXY_CACHE_TTL_DAYS = 30;

function resolveImageProxyCacheTtlDays(): number {
  const raw = process.env.IMAGE_PROXY_CACHE_TTL_DAYS;
  if (raw === undefined || raw === "") {
    return DEFAULT_IMAGE_PROXY_CACHE_TTL_DAYS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid IMAGE_PROXY_CACHE_TTL_DAYS env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_IMAGE_PROXY_CACHE_TTL_DAYS} days) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

export const IMAGE_PROXY_CACHE_TTL_DAYS = resolveImageProxyCacheTtlDays();
