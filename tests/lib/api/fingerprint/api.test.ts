import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFingerprint, patchFingerprintOverrides } from "@/lib/api/fingerprint/api";

/**
 * Ticket #117 — `fetchFingerprint`/`patchFingerprintOverrides` transport behaviour
 * against the real response shapes documented on `app/api/profiles/[id]/fingerprint/
 * route.ts` (both `404` variants, `401`, `500`). Fetch is stubbed per-test with a
 * committed-inline fixture (no network — `tests/setup/blockLiveFetch.ts` throws on any
 * unstubbed call), mirroring `tests/server/scrapecreators/client.test.ts`'s pattern.
 */

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const VIEW_FIXTURE = {
  topicNicheDistribution: [{ value: "FINANCE", count: 4, share: 0.8 }],
  formatArchetypeDistribution: [],
  hookTypeDistribution: [],
  ctaTypeDistribution: [],
  ctaTimingDistribution: [],
  pacingDistribution: [],
  audienceCalloutRate: 0.6,
  medianCutsPerMinute: 12,
  typicalBeatSequence: [],
  medianBeatCount: 5,
  verbalTonePatterns: [],
  captionStyleExemplars: [],
  hookTextExemplars: [],
  onScreenTextExemplars: [],
  sampleSize: 5,
  sourceAnalysisIds: ["a1", "a2", "a3", "a4", "a5"],
  dateRange: { earliest: "2026-05-01", latest: "2026-07-20" },
  profileId: "profile-1",
  fingerprintVersion: 1,
  schemaVersion: 2,
  consistencyIndex: 0.71,
  computedAt: "2026-07-25 02:51:00",
  createdAt: "2026-07-01 00:00:00",
  updatedAt: "2026-07-25 02:51:00",
  overriddenKeys: ["verbalTonePatterns"],
};

describe("fetchFingerprint", () => {
  it("returns the 200 view payload byte-for-byte (no reshaping)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(VIEW_FIXTURE, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchFingerprint("profile-1");

    expect(result).toEqual(VIEW_FIXTURE);
    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/profile-1/fingerprint", undefined);
  });

  it("resolves a NO_FINGERPRINT 404 to a typed absence value, not a throw", async () => {
    const body = {
      error: "No fingerprint available for this profile yet.",
      reason: "NO_FINGERPRINT",
      analysisCount: 3,
      required: 5,
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, 404)));

    const result = await fetchFingerprint("profile-1");

    expect(result).toEqual(body);
  });

  it("resolves a PROFILE_NOT_FOUND 404 to a typed absence value, not a throw", async () => {
    const body = { error: "Profile not found.", reason: "PROFILE_NOT_FOUND" };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, 404)));

    const result = await fetchFingerprint("unknown-profile");

    expect(result).toEqual(body);
  });

  it("throws on a 404 whose body is missing a valid reason, instead of resolving as a typed absence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Not found." }, 404)));

    await expect(fetchFingerprint("profile-1")).rejects.toThrow("Not found.");
  });

  it("throws on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Unauthorized" }, 401)));

    await expect(fetchFingerprint("profile-1")).rejects.toThrow("Unauthorized");
  });

  it("throws on 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "Unable to fetch fingerprint." }, 500)),
    );

    await expect(fetchFingerprint("profile-1")).rejects.toThrow("Unable to fetch fingerprint.");
  });
});

describe("patchFingerprintOverrides", () => {
  it("PATCHes JSON and returns the merged 200 view as-is", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(VIEW_FIXTURE, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await patchFingerprintOverrides("profile-1", { medianBeatCount: null });

    expect(result).toEqual(VIEW_FIXTURE);
    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/profile-1/fingerprint", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medianBeatCount: null }),
    });
  });

  it("resolves a NO_FINGERPRINT 404 to a typed absence value, not a throw", async () => {
    const body = {
      error: "No fingerprint available for this profile yet.",
      reason: "NO_FINGERPRINT",
      analysisCount: 3,
      required: 5,
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, 404)));

    const result = await patchFingerprintOverrides("profile-1", { pacingDistribution: [] });

    expect(result).toEqual(body);
  });

  it("throws on a 400 invalid patch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "Invalid override patch.", invalidKeys: ["hookTypeDistribution"] }, 400),
      ),
    );

    await expect(patchFingerprintOverrides("profile-1", { hookTypeDistribution: "bad" })).rejects.toThrow(
      "Invalid override patch.",
    );
  });

  it("throws on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Unauthorized" }, 401)));

    await expect(patchFingerprintOverrides("profile-1", {})).rejects.toThrow("Unauthorized");
  });
});
