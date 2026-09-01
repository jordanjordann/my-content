import type { Client } from "@libsql/client";

import { db } from "@/lib/server/db";

import { STRANDED_PENDING_THRESHOLD_MINUTES } from "./constants";
import type { ReapResult } from "./types";

/**
 * #313 / #280 — marks stranded `pending` analysis rows `failed` at process
 * boot. NEVER deletes (standing owner ruling: "never delete analyses" / "no
 * backfill"). Called from `instrumentation.ts`'s `register()`.
 *
 * Concurrency, by construction of the single guarded UPDATE below (verified
 * against a real libsql `file:` DB, see TDD §2.2/§5.3):
 *   - A row still genuinely `pending` and past the threshold: guard matches,
 *     `rowsAffected = 1`, row becomes `failed`.
 *   - A row that already reached a terminal state (`completed`/`failed`):
 *     `status = 'pending'` no longer matches, `rowsAffected = 0` for that
 *     row. The reaper cannot demote a finished row — terminal states are
 *     structurally immune.
 *   - If a late-finishing analysis's completion write (`WHERE id = ?`, no
 *     status predicate) lands AFTER this sweep already marked the row
 *     `failed`, that write overwrites it back to `completed`. The pipeline
 *     always wins; a late completion repairs its own row.
 *   - Two reaper runs (two boots, or two replicas) are naturally idempotent:
 *     the second run's guard matches 0 rows for any row the first already
 *     reaped.
 *
 * `updated_at` is deliberately NOT touched: the analyses list sorts
 * `updated_at DESC`, and the original timestamp is the only forensic record
 * of when the row was stranded. Idempotency does not depend on it — the
 * `status` guard already provides that.
 *
 * The default-parameter `client` lets tests drive a real `/tmp` `file:` DB
 * directly; production calls `reapStrandedAnalyses()` with no argument and
 * gets the module-level `db` singleton.
 */
export async function reapStrandedAnalyses(client: Client = db): Promise<ReapResult> {
  const result = await client.execute({
    sql: `
      UPDATE analyses
      SET status = 'failed'
      WHERE status = 'pending'
        AND updated_at < datetime('now', ?)
    `,
    args: [`-${STRANDED_PENDING_THRESHOLD_MINUTES} minutes`],
  });

  return { reaped: result.rowsAffected };
}
