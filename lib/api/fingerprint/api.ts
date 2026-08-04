import type { FingerprintOverridePatch, FingerprintResult, FingerprintView } from "./types";

/**
 * Shared transport for both verbs. A `404` is resolved to the parsed body (the route's
 * real `PROFILE_NOT_FOUND`/`NO_FINGERPRINT` shape) rather than thrown — cold start is a
 * normal product state, not an error (TDD §3 D7). Every other non-`ok` status
 * (`401`/`400`/`500`) still throws, same as `lib/api/analyses/api.ts`'s `fetchJson`.
 * Returns the parsed JSON as-is either way — no reshaping, no field renaming.
 */
async function fingerprintRequest(url: string, init?: RequestInit): Promise<FingerprintResult> {
  const response = await fetch(url, init);
  const data = await response.json();

  if (response.status === 404) {
    return data as FingerprintResult;
  }

  if (!response.ok) {
    const error = new Error((data as { error?: string }).error ?? response.statusText);
    (error as Error & { status: number }).status = response.status;
    throw error;
  }

  return data as FingerprintView;
}

export async function fetchFingerprint(profileId: string): Promise<FingerprintResult> {
  return fingerprintRequest(`/api/profiles/${encodeURIComponent(profileId)}/fingerprint`);
}

export async function patchFingerprintOverrides(
  profileId: string,
  patch: FingerprintOverridePatch,
): Promise<FingerprintResult> {
  return fingerprintRequest(`/api/profiles/${encodeURIComponent(profileId)}/fingerprint`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
