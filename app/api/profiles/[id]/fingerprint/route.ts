import { NextResponse } from "next/server";

import { db } from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";
import { ANALYSIS_SCHEMA_VERSION } from "@/lib/server/analysis/schema";
import {
  applyFingerprintOverridePatch,
  countCompletedV2Analyses,
  getFingerprint,
  MIN_ANALYSES_FOR_FINGERPRINT,
} from "@/lib/server/fingerprint";
import type { FingerprintView } from "@/lib/server/fingerprint";

/**
 * `GET`/`PATCH /api/profiles/[id]/fingerprint` — Ticket #73 sub-ticket B
 * (`docs/TDD-fingerprint-read-override-api.md` §4, §8[B]). Thin HTTP shell
 * over the `lib/server/fingerprint` module shipped by ticket A (#115,
 * PR #120) — this file does no aggregation, validation, or SQL of its own
 * beyond a profile-existence check for the `PROFILE_NOT_FOUND` vs.
 * `NO_FINGERPRINT` distinction (TDD D7).
 *
 * **Non-obvious behaviour (TDD §3 D3), stated plainly for future readers:**
 * in a `PATCH` request body, a key with a non-`null` value SETS that key's
 * override; a key with a value of literal `null` DELETES that key's
 * override and reverts it to the computed value on the next `GET`. This is
 * true for every overridable key, including ones whose `computed` value can
 * itself legitimately be `null` (e.g. `medianCutsPerMinute`,
 * `medianBeatCount`) — there is no way to override a key TO `null` via this
 * endpoint, only to remove the override entirely.
 *
 * Never wrap more than one lib-layer call in a route-local
 * `db.transaction()` here — `patchFingerprintOverrides` (used via
 * `applyFingerprintOverridePatch`) is already a single atomic
 * `UPDATE ... RETURNING *`, and `db.transaction()` on this repo's libsql
 * local sqlite3 driver leaks the underlying native connection (see
 * `lib/server/fingerprint/repository.ts`'s `patchFingerprintOverrides` doc
 * comment for the full writeup). `applyFingerprintOverridePatch` does
 * read -> validate -> patch as three separate calls, which leaves a small,
 * known, accepted TOCTOU window at the orchestration level (the patch write
 * itself is atomic) — do not attempt to close that window in this route.
 */

export const runtime = "nodejs";

async function profileExists(profileId: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT 1 FROM profiles WHERE id = ? LIMIT 1",
    args: [profileId],
  });
  return result.rows.length > 0;
}

function serializeView(view: FingerprintView) {
  return view;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const view = await getFingerprint(id);
    if (view) {
      return NextResponse.json(serializeView(view));
    }

    if (!(await profileExists(id))) {
      return NextResponse.json({ error: "Profile not found.", reason: "PROFILE_NOT_FOUND" }, { status: 404 });
    }

    const analysisCount = await countCompletedV2Analyses(id, ANALYSIS_SCHEMA_VERSION);
    return NextResponse.json(
      {
        error: "No fingerprint available for this profile yet.",
        reason: "NO_FINGERPRINT",
        analysisCount,
        required: MIN_ANALYSES_FOR_FINGERPRINT,
      },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch fingerprint." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const patch = body as Record<string, unknown>;

    // Validate the WHOLE patch before any write happens — nothing is
    // written on a 400 (TDD §4, "Nothing is written on a 400"). This checks
    // patch values against the profile's CURRENT `computed` fingerprint, so
    // it must run against an existing row; a missing row is handled below,
    // via `applyFingerprintOverridePatch`'s own `NOT_FOUND` result, in the
    // same order the lib layer's own orchestrator already validates before
    // writing.
    const result = await applyFingerprintOverridePatch(id, patch);

    if (result.ok) {
      return NextResponse.json(serializeView(result.view));
    }

    if (result.reason === "INVALID") {
      return NextResponse.json({ error: "Invalid override patch.", invalidKeys: result.invalidKeys }, { status: 400 });
    }

    // reason === "NOT_FOUND": distinguish an unknown profile from a known
    // profile with no fingerprint row yet, same as GET (TDD D7).
    if (!(await profileExists(id))) {
      return NextResponse.json({ error: "Profile not found.", reason: "PROFILE_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "No fingerprint available for this profile yet.", reason: "NO_FINGERPRINT" },
      { status: 404 },
    );
  } catch (error) {
    if (error instanceof Error && /non-overridable field/.test(error.message)) {
      // Backstop only — `validateOverridePatch` already rejects
      // NON_OVERRIDABLE_FIELDS before `applyFingerprintOverridePatch` ever
      // reaches the repository's own throw path, so this should be
      // unreachable in normal operation. Surfaced as 400, not 500, in case
      // it is ever hit.
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to patch fingerprint." },
      { status: 500 },
    );
  }
}
