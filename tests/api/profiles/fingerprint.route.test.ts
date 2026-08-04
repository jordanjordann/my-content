import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import type { StyleAttributes } from "@/lib/server/analysis/types";

/**
 * Route-level tests for `app/api/profiles/[id]/fingerprint/route.ts`
 * (Ticket #73 sub-ticket B, #116). The first route-level test in this repo
 * (TDD §7 risk 2) — `@/lib/server/auth` is mocked with `vi.mock` so these
 * tests never touch cookies/sessions, only the HTTP status/body contract and
 * the underlying `lib/server/fingerprint` read/write behaviour end to end
 * through the route handlers.
 *
 * Same fresh-`:memory:`-libsql-per-test technique as
 * tests/server/fingerprint/service.test.ts.
 */

const { isAuthenticatedMock } = vi.hoisted(() => ({
  isAuthenticatedMock: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

function buildStyle(overrides: Partial<StyleAttributes> = {}): StyleAttributes {
  return {
    topicNiche: "FOOD_CULINARY",
    topicSubtopic: "resep cepat",
    formatArchetype: "TALKING_HEAD",
    hookType: "DIRECT_VALUE_PROMISE",
    hookTypeSecondary: null,
    hasAudienceCallout: false,
    hookText: "Ini resep favoritku",
    structureBeatMap: [{ timestampSec: 0, beatType: "HOOK", description: "pembuka" }],
    pacing: "MEDIUM",
    estimatedCutsPerMinute: 10,
    ctaType: ["FOLLOW"],
    ctaTiming: "END",
    onScreenText: ["Resep hari ini"],
    captionStyleNotes: "Gaya santai dengan emoji",
    verbalTonePatterns: ["santai"],
    ...overrides,
  };
}

async function runMigrations(db: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

async function insertProfile(db: Client, id: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO profiles (id, platform, username) VALUES (?, 'instagram', ?)",
    args: [id, `creator-${id}`],
  });
}

async function insertAnalysis(
  db: Client,
  opts: {
    profileId: string;
    schemaVersion: number | null;
    status?: string;
    style?: Partial<StyleAttributes>;
  },
): Promise<string> {
  const id = randomUUID();
  const content = { schemaVersion: opts.schemaVersion ?? 2, style: buildStyle(opts.style) };
  await db.execute({
    sql: `
      INSERT INTO analyses (
        id, prompt, url, platform, media_type, profile_id, status,
        schema_version, result_content
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, ?, ?, ?)
    `,
    args: [id, opts.profileId, opts.status ?? "completed", opts.schemaVersion, JSON.stringify(content)],
  });
  return id;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makePatchRequest(body: unknown, rawBody?: string) {
  return new Request("http://localhost/api/profiles/x/fingerprint", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new Request("http://localhost/api/profiles/x/fingerprint", { method: "GET" });
}

let db: Client;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let routeModule: any;

beforeEach(async () => {
  vi.resetModules();
  isAuthenticatedMock.mockReset();
  process.env.TURSO_DATABASE_URL = ":memory:";
  delete process.env.TURSO_AUTH_TOKEN;
  const dbModule = await import("@/lib/server/db");
  db = dbModule.db;
  await runMigrations(db);
  routeModule = await import("@/app/api/profiles/[id]/fingerprint/route");
});

afterEach(() => {
  db?.close();
  vi.restoreAllMocks();
});

describe("GET /api/profiles/[id]/fingerprint — auth", () => {
  it("401 when unauthenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    const response = await routeModule.GET(makeGetRequest(), makeParams(randomUUID()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("PATCH /api/profiles/[id]/fingerprint — auth", () => {
  it("401 when unauthenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    const response = await routeModule.PATCH(makePatchRequest({ medianBeatCount: null }), makeParams(randomUUID()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("GET /api/profiles/[id]/fingerprint — unknown profile", () => {
  it("404 PROFILE_NOT_FOUND for an id with no profiles row at all", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const response = await routeModule.GET(makeGetRequest(), makeParams(randomUUID()));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.reason).toBe("PROFILE_NOT_FOUND");
    expect(body.analysisCount).toBeUndefined();
  });
});

describe("GET /api/profiles/[id]/fingerprint — cold start (D7)", () => {
  it("404 NO_FINGERPRINT with analysisCount:4 at 4 qualifying analyses", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 4; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }

    const response = await routeModule.GET(makeGetRequest(), makeParams(profileId));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.reason).toBe("NO_FINGERPRINT");
    expect(body.analysisCount).toBe(4);
    expect(body.required).toBe(5);
  });

  it("200 with sampleSize:5 once a fingerprint has been computed", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    const response = await routeModule.GET(makeGetRequest(), makeParams(profileId));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sampleSize).toBe(5);
    expect(body.profileId).toBe(profileId);
    expect(body.overriddenKeys).toEqual([]);
  });
});

describe("PATCH /api/profiles/[id]/fingerprint — override write + read-back", () => {
  it("PATCH a verbalTonePatterns override, then GET reflects it in overriddenKeys", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    const overrideValue = [{ value: "santai", count: 1, share: 1 }];
    const patchResponse = await routeModule.PATCH(
      makePatchRequest({ verbalTonePatterns: overrideValue }),
      makeParams(profileId),
    );
    expect(patchResponse.status).toBe(200);
    const patchBody = await patchResponse.json();
    expect(patchBody.verbalTonePatterns).toEqual(overrideValue);
    expect(patchBody.overriddenKeys).toEqual(["verbalTonePatterns"]);

    const getResponse = await routeModule.GET(makeGetRequest(), makeParams(profileId));
    const getBody = await getResponse.json();
    expect(getBody.verbalTonePatterns).toEqual(overrideValue);
    expect(getBody.overriddenKeys).toEqual(["verbalTonePatterns"]);
  });

  it("PATCH only ever writes the overrides column, never computed", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint, getFingerprintRow } = await import("@/lib/server/fingerprint");
    const beforeRow = await recomputeFingerprint(profileId);

    await routeModule.PATCH(
      makePatchRequest({ verbalTonePatterns: [{ value: "santai", count: 1, share: 1 }] }),
      makeParams(profileId),
    );

    const afterRow = await getFingerprintRow(profileId);
    expect(afterRow!.computed).toEqual(beforeRow!.computed);
    expect(afterRow!.overrides).toEqual({ verbalTonePatterns: [{ value: "santai", count: 1, share: 1 }] });
  });

  it("survives a 6th analysis being recomputed: computed changes, override survives, GET shows the human value", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint, getFingerprintRow } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    const overrideValue = [{ value: "santai", count: 1, share: 1 }];
    await routeModule.PATCH(makePatchRequest({ verbalTonePatterns: overrideValue }), makeParams(profileId));

    // 6th analysis lands, recompute runs again (same service-level path
    // exercised by tests/server/fingerprint/service.test.ts).
    await insertAnalysis(db, { profileId, schemaVersion: 2 });
    const recomputed = await recomputeFingerprint(profileId);
    expect(recomputed!.sampleSize).toBe(6);

    const row = await getFingerprintRow(profileId);
    expect(row!.overrides).toEqual({ verbalTonePatterns: overrideValue });

    const getResponse = await routeModule.GET(makeGetRequest(), makeParams(profileId));
    const body = await getResponse.json();
    expect(body.sampleSize).toBe(6);
    expect(body.verbalTonePatterns).toEqual(overrideValue);
    expect(body.overriddenKeys).toEqual(["verbalTonePatterns"]);
  });

  it("PATCH with an invalid enum value -> 400, and a follow-up GET is byte-identical to pre-PATCH", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    const beforeResponse = await routeModule.GET(makeGetRequest(), makeParams(profileId));
    const beforeBody = await beforeResponse.text();

    const patchResponse = await routeModule.PATCH(
      makePatchRequest({ pacingDistribution: [{ value: "NOT_A_REAL_PACING", count: 1, share: 1 }] }),
      makeParams(profileId),
    );
    expect(patchResponse.status).toBe(400);
    const patchBody = await patchResponse.json();
    expect(patchBody.invalidKeys).toEqual(["pacingDistribution"]);

    const afterResponse = await routeModule.GET(makeGetRequest(), makeParams(profileId));
    const afterBody = await afterResponse.text();
    expect(afterBody).toBe(beforeBody);
  });

  it("PATCH { key: null } removes the override; the merged view reverts to computed", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint, getFingerprintRow } = await import("@/lib/server/fingerprint");
    const computedRow = await recomputeFingerprint(profileId);

    const overrideValue = [{ value: "santai", count: 1, share: 1 }];
    await routeModule.PATCH(makePatchRequest({ verbalTonePatterns: overrideValue }), makeParams(profileId));

    const removeResponse = await routeModule.PATCH(
      makePatchRequest({ verbalTonePatterns: null }),
      makeParams(profileId),
    );
    expect(removeResponse.status).toBe(200);
    const removeBody = await removeResponse.json();
    expect(removeBody.verbalTonePatterns).toEqual(computedRow!.computed.verbalTonePatterns);
    expect(removeBody.overriddenKeys).toEqual([]);

    const row = await getFingerprintRow(profileId);
    expect(row!.overrides).toBeNull();
  });

  it("PATCH attempting to override sampleSize -> 400", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    const response = await routeModule.PATCH(makePatchRequest({ sampleSize: 99 }), makeParams(profileId));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.invalidKeys).toEqual(["sampleSize"]);
  });

  it("PATCH on a profile with no fingerprint row -> 404 NO_FINGERPRINT", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 4; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }

    const response = await routeModule.PATCH(
      makePatchRequest({ medianBeatCount: null }),
      makeParams(profileId),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    // PATCH's NO_FINGERPRINT body must match GET's shape (PR #121 review
    // follow-up #2) — a client hitting "you need N more videos" from a PATCH
    // has the same need for the count as it does from a GET.
    expect(body).toEqual({
      error: "No fingerprint available for this profile yet.",
      reason: "NO_FINGERPRINT",
      analysisCount: 4,
      required: 5,
    });
  });

  it("PATCH on an unknown profile id -> 404 PROFILE_NOT_FOUND", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const response = await routeModule.PATCH(makePatchRequest({ medianBeatCount: null }), makeParams(randomUUID()));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.reason).toBe("PROFILE_NOT_FOUND");
  });

  it("non-object body -> 400", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    const response = await routeModule.PATCH(makePatchRequest(undefined, JSON.stringify([1, 2, 3])), makeParams(profileId));
    expect(response.status).toBe(400);
  });

  it("PATCH {\"constructor\":\"x\"} -> 400, not 200, and nothing is written (PR #121 review follow-up)", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint, getFingerprintRow } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    const response = await routeModule.PATCH(
      makePatchRequest(undefined, JSON.stringify({ constructor: "x" })),
      makeParams(profileId),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.invalidKeys).toEqual(["constructor"]);

    const row = await getFingerprintRow(profileId);
    expect(row!.overrides).toBeNull();
  });

  it("PATCH {\"__proto__\":\"x\"} -> 400, not 500, and nothing is written (PR #121 review follow-up)", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    const { recomputeFingerprint, getFingerprintRow } = await import("@/lib/server/fingerprint");
    await recomputeFingerprint(profileId);

    // Raw JSON string, not an object literal: `{ __proto__: "x" }` as a JS
    // object literal sets the prototype itself (so `JSON.stringify` would
    // serialize it back to `{}`), whereas a real HTTP PATCH body parses
    // `__proto__` as a genuine own-enumerable key via `JSON.parse` — this is
    // the actual repro path.
    const response = await routeModule.PATCH(
      makePatchRequest(undefined, '{"__proto__":"x"}'),
      makeParams(profileId),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.invalidKeys).toEqual(["__proto__"]);

    const row = await getFingerprintRow(profileId);
    expect(row!.overrides).toBeNull();
  });
});
