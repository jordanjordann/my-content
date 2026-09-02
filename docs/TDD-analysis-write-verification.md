# TDD — Analysis write verification: phantom `existingId` (#281) and stranded `pending` rows (#280)

**Author:** John (Tech Lead)
**Date:** 2026-09-01
**Base:** `main` @ `9f0fb4a`
**Source tickets:** [#281](https://github.com/jordanjordann/my-content/issues/281) (audit F-10, P1), [#280](https://github.com/jordanjordann/my-content/issues/280) (audit F-09, P1)
**Status:** Approved to build. Both source tickets carry a stale `## Owner decision: No.` — the owner confirmed this session that the "No" answered a different question and is **not** a rejection. Clarification comments posted on both issues.

---

## 1. The single underlying weakness

Both findings are the same defect wearing two hats: **the code assumes a database write did something and never checks.**

- **#281** — an `UPDATE` that matches **0 rows** is treated as success. libsql resolves it without throwing, so a re-analysis against a deleted id runs a full paid pipeline and reports `200 OK`.
- **#280** — a row is written as `pending` and, if the process dies, **nobody ever comes back for it**. There is no write at all, so there is nothing to check.

They are designed here as one coherent piece of work but ship as **two independent tickets**. #281 is the one actively costing money and goes first.

---

## 2. Verification of the audit's claims (executed, not reasoned)

Every claim below was checked against the code at `9f0fb4a` and/or proven by running it against a throwaway libsql `file:` DB in `/tmp`.

### 2.1 Confirmed as stated (mechanism), line numbers DRIFTED

The audit tickets were written 2026-08-21. `lib/server/analysis/pipeline/index.ts` has since grown to 610 lines. **Every line number in both tickets is wrong.** Corrected map:

| Ticket claim | Ticket line | **Actual line @ `9f0fb4a`** | Verdict |
|---|---|---|---|
| `const analysisId = existingId ?? randomUUID()` | `:68` | **`:96`** | Code correct, line drifted |
| re-analysis `UPDATE … WHERE id = ?`, unchecked | `:80-89` | **`:109-119`** | Code correct, line drifted |
| `INSERT … status='pending'` | `:91` | **`:120-126`** | Code correct, line drifted |
| final `status='completed'` write, unchecked | `:358-372` / `:362` | **`:554-568`** | Code correct, line drifted |
| new-analysis failure **DELETEs** the row | `:397` | **`:592-597`** | Code correct, line drifted |
| error path `UPDATE … status='failed'`, unchecked | `:400-404` / `:402` | **`:598-601`** | Code correct, line drifted |
| `existingId` shape-only validation | `route.ts:39-47` | **`app/api/analyze/route.ts:44-52`** | Code correct, line drifted |
| `deleteAnalysis` ignores `rowsAffected` | `lib/server/db.ts:301-306` | **`lib/server/db.ts:325-330`** | Code correct, line drifted |
| route returns `{success:true}` unconditionally | `analyses/route.ts:258-260` | **`:258-260`** | Exact, still accurate |

`grep -rn "rowsAffected" --include="*.ts"` across the repo (excluding `node_modules`) returns **zero hits**. No write anywhere in this codebase is verified.

### 2.2 Proven by execution (`/tmp` libsql `file:` DB)

```
0-row UPDATE threw? NO.   rowsAffected = 0   (typeof number)
1-row UPDATE                rowsAffected = 1
0-row DELETE                rowsAffected = 0
guarded UPDATE ... AND status='pending'  (row IS pending) → rowsAffected = 1
guarded UPDATE ... AND status='pending'  (row now failed) → rowsAffected = 0
sweep: status='pending' AND updated_at < datetime('now','-30 minutes'), row 45 min old → rowsAffected = 1
```

This confirms (a) the silent-no-op mechanism, (b) that `rowsAffected` is a plain `number` available on every `execute()` result, and (c) that a status-guarded `UPDATE` is naturally idempotent — the basis of the #280 concurrency design.

### 2.3 A premise in #281's *suggested fix* that is WRONG — flagging plainly

#281 suggests "assert `rowsAffected === 1` on the re-analysis `UPDATE`" as an alternative to a route-level `SELECT`, as if the two were interchangeable ways to get a 404. **They are not.**

`app/api/analyze/route.ts:60-70` wraps each `runAnalysis` call in a `try/catch` that pushes the error into `failedUrls` and then, at `:72-76`, returns:

```
200 { analysisIds: [], analysesCreated: 0, failedUrls: [...] }
```

So a `throw` from inside the pipeline **cannot produce a 404** — it produces a `200` with an empty result. The pipeline assertion alone would fix the wasted spend but would leave the ticket's own stated acceptance ("return 404") unmet. The 404 must come from the route. This TDD does **both**, for different reasons (§4.1).

### 2.4 Claims verified as still true, no drift

- `analyses.status` `CHECK(status IN ('pending','completed','failed'))` survives the latest table rebuild (`migrations/013_reach_unavailable_reason.sql:47`). **`'failed'` is already a legal value — no migration is needed to write it.**
- The batch loop at `app/api/analyze/route.ts:60` is `for (const [index, url] of urls.entries())` with `await runAnalysis(...)` inside — **strictly sequential**. This is load-bearing for the #280 threshold (§5.2).
- `railway.json`: `preDeployCommand: "npx tsx scripts/migrate.ts"`, `restartPolicyType: "ON_FAILURE"`, no replica count set. Deploys are manual (OR-6). Nothing in this TDD changes any of it.
- `instrumentation.ts` `register()` already exists and already runs a boot guard (#244). Per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`, `register` "is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests" and "can be an async function." Both properties are relied on in §5.1.

### 2.5 The refuted claim, not reintroduced

Navigating away or closing the tab does **not** strand a row. The server completes a request it has already received. Nothing in this design treats client disconnect as a stranding cause, and the #280 ticket explicitly forbids re-litigating it.

---

## 3. Data model

**No migration. No schema change. No new column, table, or index.**

This is a deliberate design goal, not an accident:

- `'failed'` is already permitted by the existing `CHECK` constraint.
- The reaper's predicate is `status = 'pending' AND updated_at < ?`. `idx_analyses_updated_at` (on `updated_at DESC`) already exists, and the `analyses` table is small; a partial scan is not a concern.
- Adding no migration means this work **cannot** interact with the `#307` runner guard (re-presented / row-destroying migrations) or the `#277/#278` checksum tracking. No existing `.sql` file is touched. `migrations/012_performance_block.sql` stays byte-identical to `main`.

If a reviewer believes a `failure_reason` column is wanted, that is a **separate ticket** — see §8.

---

## 4. #281 — Validate `existingId`, verify every write

### 4.1 Design call: do BOTH checks, for different reasons

| Check | Where | Purpose |
|---|---|---|
| **A. Existence `SELECT`** | `app/api/analyze/route.ts`, **before** the URL loop | Produces the **404**. HTTP status is the route's concern; the pipeline's `throw` is swallowed into `failedUrls` (§2.3) and can never surface one. |
| **B. `rowsAffected === 1` assertion** | `lib/server/analysis/pipeline/index.ts`, on the re-analysis `UPDATE` | Closes the **TOCTOU window**. Check A is a read; the row can be deleted between the `SELECT` and the `UPDATE`. B makes the pipeline refuse to proceed on a row that vanished — and it sits at the very top of the `try` block, **before `fetchMetadata`**, so it fires before any paid call either way. |

Neither alone is sufficient. A gives the correct contract; B gives the money guarantee under a race. Both are cheap (one indexed primary-key read; one integer comparison on a query already being issued).

**Placement of A is load-bearing:** it must run *before the loop*, not inside `runAnalysis`, because the whole point is to spend nothing. At that position no ScrapeCreators fetch and no Gemini call has been made.

### 4.2 The other two unchecked writes — asymmetric handling

- **Completion write** (`:554-568`, `status='completed'`): assert `rowsAffected === 1`. `0` means the row was deleted mid-run. **Throw.** A completed analysis that was written nowhere must not be reported as success.
- **Error-path write** (`:598-601`, `status='failed'`): assert, but **log only — never throw.** This runs inside a `catch`. Throwing here would replace the real, diagnostic original error with a bookkeeping error and destroy the actual failure cause. This asymmetry is deliberate and must be preserved by the implementer.
- **New-analysis error path** (`:592-597`, `DELETE`): leave functionally as-is. It deletes a row the same request just inserted, so `0` is genuinely unexpected — log a warning, do not throw (same `catch`-block reasoning). This is **not** a violation of the "never delete analyses" ruling: it is the same request cleaning up its own uncommitted work, and it is pre-existing behaviour, not something this TDD introduces.

### 4.3 Bundled: `deleteAnalysis` lies about success (audit P2)

`lib/server/db.ts:325-330` discards the result; `app/api/analyses/route.ts:258-260` returns `{ success: true }` for any id. Same class, same fix shape:

- `deleteAnalysis` returns `{ deleted: boolean }` derived from `rowsAffected > 0`.
- The `DELETE` route returns **404** `{ error: "Analysis not found." }` when `deleted` is `false`, and `{ success: true }` otherwise.

### 4.4 API contract changes

| Endpoint | Condition | Before | After |
|---|---|---|---|
| `POST /api/analyze` | `existingId` present, row absent | `200 {"analysisIds":["<id>"],"analysesCreated":1}` after full paid run | `404 {"error":"Analysis not found."}`, **zero external calls** |
| `POST /api/analyze` | `existingId` present, row exists | unchanged | unchanged |
| `POST /api/analyze` | no `existingId` | unchanged | unchanged |
| `DELETE /api/analyses?id=…` | row absent | `200 {"success":true}` | `404 {"error":"Analysis not found."}` |
| `DELETE /api/analyses?id=…` | row exists | `200 {"success":true}` | unchanged |

Existing 400s (missing urls, batch too large, non-string urls, `existingId` + multi-URL) keep their current precedence and run **before** the new existence check — the new check is added after them so a malformed request still fails cheaply on shape.

### 4.5 File tree — #281

```
app/api/analyze/route.ts              (Modify)  existence check → 404
app/api/analyses/route.ts             (Modify)  DELETE → 404 when nothing removed
lib/server/db.ts                      (Modify)  analysisExists(); deleteAnalysis returns {deleted}
lib/server/analysis/pipeline/index.ts (Modify)  3 rowsAffected assertions
tests/api/analyze/existingId.test.ts  (Create)
tests/api/analyses/delete.test.ts     (Create)
```

New helper in `lib/server/db.ts`, next to `getAnalysisDetail`:

```ts
export async function analysisExists(analysisId: string): Promise<boolean>
// SELECT 1 FROM analyses WHERE id = ? LIMIT 1  → rows.length > 0
```

`SELECT 1 … LIMIT 1`, not `getAnalysisDetail` — the detail reader hydrates dozens of columns and parses JSON for a question that only needs existence.

---

## 5. #280 — Reaper for stranded `pending` rows

**Owner constraint, load-bearing:** standing ruling "never delete analyses" / "no backfill". The reaper **marks `failed` and never deletes.** No `DELETE` statement appears anywhere in this design. If an implementer concludes deletion is required for some case, they must **stop and raise it**, not implement it.

### 5.1 Design call: where the sweep runs → **process startup, in `instrumentation.ts`**

Options considered:

| Option | Verdict |
|---|---|
| **Startup (`instrumentation.ts register()`)** | **Chosen.** |
| Cron / scheduled job | Rejected. Requires new Railway infra (a cron service or schedule). Deploys are manual by ruling OR-6; adding scheduled infrastructure is scope creep for a bug fix, and there is nothing for a cron to find between restarts (§ below). |
| Lazily on read (`GET /api/analyses`) | Rejected. Puts an unbounded write on the hot read path, makes list responses non-deterministic, and is harder to test than a single explicit call. |

**Why startup is not merely convenient but a 1:1 match for the failure mode:** the only proven cause of a stranded row is **the process dying mid-analysis** (Railway deploy/restart — observed at 05:02 on audit day — or OOM kill). A row can only be stranded by a process that has died, and a new process always boots afterward. A running process strands nothing: it either completes the row, marks it `failed` (re-analyse), or deletes it (new analysis). So every stranded row is, by construction, cleaned up at the next boot.

Accepted limitation, to be stated in the ticket: **if the process dies and never restarts, nothing is reaped.** That is acceptable — the application is down, and the stranded row is the smaller problem.

`register()` already exists and already runs a Node-only boot guard. The reaper is added inside the same positive `if (process.env.NEXT_RUNTIME === "nodejs")` block. **Do not restructure that block into a negated early return** — `instrumentation.ts`'s own comment records that this shape is what avoids a Turbopack Edge-chunk warning.

**Crucial difference from the #244 env guard:** the env guard calls `process.exit(1)` on failure. The reaper must **never** do that. It is wrapped in its own `try/catch` that logs and swallows. A reaper failure must not prevent the server from booting — a cosmetic row status is not worth a dead container. `register()` must complete before requests are served, so the sweep must be a single fast statement (it is: one `UPDATE`).

### 5.2 Design call: the threshold → **30 minutes on `updated_at`**

This is the most dangerous part of the design. A reaper that kills healthy in-flight work is worse than the bug.

Evidence used:
- Measured: a single analysis takes **45–73 s**. A 10-URL batch takes ~7–18 minutes.
- **The batch is sequential** (verified, §2.4). Row *N* is only `INSERT`ed as `pending` when its own turn begins and reaches terminal status before row *N+1* is inserted. So a healthy row's **pending window is one analysis (45–73 s), never the batch's 7–18 minutes.** Anyone reasoning from the batch duration would over-size the threshold; anyone reasoning from it in the other direction would under-size it. This is why it is written down.
- Code-derived worst case for one analysis: `DOWNLOAD_TIMEOUT_MS = 120_000` per download (a carousel does several), `pollUntilReady(maxAttempts = 30)`, `TITLE_TIMEOUT_MS = 15_000`. A pathological carousel is still comfortably inside single-digit minutes.

**30 minutes** is ~25× the observed p100 and several times the code-derived pathological ceiling.

There is a second, independent line of defence that makes the threshold a *margin* rather than the sole correctness mechanism: **at the moment a fresh process boots, it has no in-flight analyses of its own.** Any `pending` row it sees was written by a process that is gone. The age threshold exists only to protect against the window where a **previous instance is still draining** during a rolling restart. 30 minutes covers that with enormous headroom.

The threshold lives in `constants.ts` as an exported named constant so a test can pin it and a future change is a one-line diff:

```ts
export const STRANDED_PENDING_THRESHOLD_MINUTES = 30;
```

**Revisit trigger to record in the ticket:** if #279 ever makes batches parallel or moves them to a background worker, a row's pending window stops being bounded by one analysis and this number must be re-derived.

### 5.3 Design call: concurrency ordering

Defined explicitly, because "the sweep marks a row failed while it is still running" is the scenario that must not corrupt anything.

The sweep is a **single status-guarded `UPDATE`**:

```sql
UPDATE analyses
SET status = 'failed'
WHERE status = 'pending'
  AND updated_at < datetime('now', '-30 minutes')
```

Ordering rules, in force by construction:

1. **Reaper → then pipeline completes.** The pipeline's completion write (`:554-568`) is keyed on `WHERE id = ?` **only**, with no status predicate. It therefore overwrites `failed` back to `completed`. **The pipeline always wins.** A late-completing analysis repairs its own row; the user sees `completed`. This is the desired outcome and requires no code change to the completion write beyond §4.2's assertion.
2. **Pipeline completes → then reaper.** The reaper's `status = 'pending'` guard no longer matches (proven by execution, §2.2: the second guarded update returned `rowsAffected = 0`). The reaper **cannot** demote a finished row. Terminal states are permanently immune.
3. **Reaper vs. reaper** (two replicas, or two boots): naturally **idempotent** for the same reason — the second run matches 0 rows.
4. **The reaper never deletes and never touches a row that is not `pending`.** Its `WHERE` clause makes both structurally impossible, which is what the acceptance criteria assert against.

**`updated_at` is deliberately NOT modified by the sweep.** Two reasons: (a) the list is sorted `updated_at DESC`, so touching it would shuffle reaped rows to the top of the user's list for no reason; (b) the original timestamp is the only forensic record of *when* the row was stranded. Idempotency does not depend on it — the `status` guard already provides that.

### 5.4 File tree — #280

Follows the repo module convention:

```
lib/server/analysis/reaper/
├── index.ts        (Create)  Barrel — re-exports only
├── reaper.ts       (Create)  reapStrandedAnalyses()
├── constants.ts    (Create)  STRANDED_PENDING_THRESHOLD_MINUTES = 30
└── types.ts        (Create)  ReapResult

instrumentation.ts                          (Modify)  call the reaper in register()
tests/server/analysis/reaper/reaper.test.ts (Create)
tests/server/instrumentation.test.ts        (Modify)  boot-integration cases
```

Signature:

```ts
export async function reapStrandedAnalyses(client: Client = db): Promise<ReapResult>;
export interface ReapResult { reaped: number }   // = result.rowsAffected
```

The **default-parameter client** is required, not stylistic: `lib/server/db.ts` builds `db` as a module-level singleton from `TURSO_DATABASE_URL` at import time. Accepting an injected `Client` lets the test drive a real `/tmp` `file:` DB directly without `vi.resetModules()` gymnastics, while production calls `reapStrandedAnalyses()` with no argument.

Returning the count (rather than logging only) is what makes the "did not reap the healthy row" assertion possible as an exact `toBe(0)` / `toBe(1)`, instead of a log-scrape.

---

## 6. Testing standard (applies to both tickets)

This repo now holds a stricter bar, established on PRs #305 and #309:

1. **Mutate the fix, not the bug.** For **every** capability a ticket claims, break that specific line in the fix and confirm a **named** test goes red. On #305 the code was correct while 4 of 5 advertised capabilities had no test that failed when deleted. On #309 the reviewer found a mutation (breaking only the "before" snapshot site) that every integration test survived. **List the mutations run and the test name that caught each one in the PR body.**
2. **Verify by execution, not by reading.** Against a throwaway libsql `file:` DB under `/tmp` (`mkdtempSync(join(tmpdir(), …))` + `createClient({ url: "file:…" })`, as `tests/server/db/migrate.test.ts:54-69` already does). Every significant finding in the last two sessions came from running something; the one purely-reasoned finding was **false**.
3. **Zero live external calls.** `tests/setup/blockLiveFetch.ts` already throws on any unstubbed `fetch`. For #281 the point of the fix is that the 404 path issues none — assert this positively (`expect(runAnalysisMock).not.toHaveBeenCalled()`), do not merely rely on the guard not firing.
4. Test files under `tests/**/*.test.ts` run in the `node` project. Do not name these `.dom.test.ts`.

---

## 7. Ticket sequencing

The two tickets are **independent** — different files, no shared symbol, no ordering constraint. They can run in parallel.

- **Ticket 1 (#281 fix)** — first if serialised. It is the one costing money.
- **Ticket 2 (#280 fix)** — parallel-safe.

The only file either shares is `lib/server/analysis/pipeline/index.ts`, and only Ticket 1 touches it. QA is manual by the owner.

---

## 8. Explicitly OUT of scope

- **Any migration or schema change.** Including a `failure_reason` / `failed_by_reaper` column. `'failed'` is indistinguishable from a re-analysis failure by design here; if provenance is wanted, file it separately.
- **Deleting stranded rows.** Forbidden by the owner ruling. Not implemented, not gated behind a flag, not present in the code.
- **The "Analysis not found" modal still rendering a Re-analyze button** (audit P3, a frontend fix). #281's server fix makes pressing it harmless and cheap, but the button itself is not touched here.
- **#279's batch-cannot-finish-in-one-request problem.** Related trigger, separate ticket. Nothing here changes `MAX_URLS_PER_BATCH` or the request model.
- **Backfilling rows already stranded in production.** The reaper handles them on the next boot, by design, with no manual step.
- **Any cron, scheduler, background worker, or deploy automation.** Deploys stay manual (OR-6).
- **Retrying a reaped analysis automatically.** The user re-analyses manually; that path already exists.
- **Auditing the ~zero other unchecked writes.** `grep` shows no `rowsAffected` use anywhere; a repo-wide write-verification sweep is a bigger piece of work than these two P1s.
