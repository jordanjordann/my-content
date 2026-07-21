export interface ImageProxyCacheEntry {
  bytes: Buffer;
  contentType: string;
}

/** Sidecar metadata written alongside the cached bytes. */
export interface ImageProxyCacheMeta {
  contentType: string;
  /** ISO-8601 timestamp of when the entry was written. */
  fetchedAt: string;
}
