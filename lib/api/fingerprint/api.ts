import type { FingerprintAbsence, FingerprintOverridePatch, FingerprintResult, FingerprintView } from "./types";

const FINGERPRINT_ABSENCE_REASONS = new Set(["PROFILE_NOT_FOUND", "NO_FINGERPRINT"]);

/**
 * True only for a `404` body that actually carries one of the route's two documented
 * `reason`s (`PROFILE_NOT_FOUND`/`NO_FINGERPRINT`). Guards against silently treating an
 * unrelated `404` with parseable-but-malformed JSON (an infra/proxy `404`, a mistyped
 * path that still returns JSON, a future route change) as a typed absence — that would
 * otherwise resolve as a "successful" result with every `FingerprintView` field
 * `undefined`, a silent data-shaped failure instead of a loud one.
 */
function isFingerprintAbsenceBody(data: unknown): data is FingerprintAbsence {
  return (
    typeof data === "object" &&
    data !== null &&
    "reason" in data &&
    FINGERPRINT_ABSENCE_REASONS.has((data as { reason: unknown }).reason as string)
  );
}

/**
 * Shared transport for both verbs. A `404` is resolved to the parsed body (the route's
 * real `PROFILE_NOT_FOUND`/`NO_FINGERPRINT` shape) rather than thrown — cold start is a
 * normal product state, not an error (TDD §3 D7) — but only when the body actually
 * carries one of those two `reason`s; any other `404` falls through to the throw branch
 * below. Every other non-`ok` status (`401`/`400`/`500`) still throws, same as
 * `lib/api/analyses/api.ts`'s `fetchJson`. Returns the parsed JSON as-is either way — no
 * reshaping, no field renaming.
 */
async function fingerprintRequest(url: string, init?: RequestInit): Promise<FingerprintResult> {
  const response = await fetch(url, init);
  const data = await response.json();

  if (response.status === 404 && isFingerprintAbsenceBody(data)) {
    return data;
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
