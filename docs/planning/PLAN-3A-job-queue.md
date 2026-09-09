# PLAN — Phase 3A: job queue / async pipeline

**Status:** **APPROVED by owner 2026-09-09. Tickets cut — see §9.**
Q1/Q2/Q3 ruled (§6 updated in place). Q4 ruled = (ii), both counter and step progress.
**Governing TDD:** `docs/TDD-3A-3B-3C-phase-3.md` §10 (3A), §11 (deploy/Turso), §0 (OR-17/OR-18/OR-23), §1.5, §2, §13 E3, §15.
**Verification posture:** every claim below was re-checked against `main` at `3b94ab5` (2026-09-09). Where the TDD
and the code disagree, **the code wins and the drift is called out explicitly** — §10 was written before 3C, the
deploy, `#295`, the security headers and the reaper landed.
**No live external calls were made.** No ScrapeCreators, no Gemini, no Railway MCP writes. Railway behaviour is
cited from Railway's public docs only.

---

## 1. Scope summary

### 1.1 What 3A is

3A moves the analysis pipeline off the HTTP request and onto a background worker. Per §10.1 the rule is:

> **3A changes *who calls* `runAnalysis()`, not what it does.**

That still holds against the code. `runAnalysis()` (`lib/server/analysis/pipeline/index.ts:85`) already:

- accepts `onProgress?: (progress: ProgressState) => void` (`:82`) and calls `report(...)` at 10 named steps,
- creates or re-uses its own `analyses` row, and owns its own success/failure writes,
- has no dependency on `Request`, cookies, or anything HTTP.

It is already worker-shaped. **3A adds no logic to the pipeline.**

### 1.2 In scope

| # | Item | Notes |
|---|---|---|
| S1 | `jobs` table + migration | **`015_jobs.sql`, not `014`** — see D1 |
| S2 | `lib/server/jobs/` — repository, claim, heartbeat, job-reaper, `runWorkerLoop()` | §2 module placement |
| S3 | `scripts/worker.ts` thin entrypoint | §10.4 |
| S4 | `/api/analyze` returns `202` + job IDs instead of running the pipeline | §10.1 |
| S5 | Job status + progress transport (SSE) and the FE rewire | §10.4; closes #287 / #290 |
| S6 | Idempotency / dedupe on `(normalised_url, prompt_hash)` | §10.1 |
| S7 | Second Railway service (`worker`), **Serverless OFF** | §11.3a A — explicitly 3A's *last* ticket |

### 1.3 Explicitly out of scope

- **Spend cap / `credits_charged` tracking.** §10.4 already carves this out. Confirmed still absent: the only
  hits for `credits_charged` in the repo are the ScrapeCreators *response type*
  (`lib/server/scrapecreators/types.ts:206`) — the value is received and **discarded**, never stored. Bulk
  ingestion stays blocked on it. 3A must not smuggle it in.
- **Parallel workers (N>1).** §10.4 fixes concurrency at 1. `claimed_by` exists from day one so N>1 needs no
  migration later.
- **Embedded libSQL replicas.** §11.2c C3 already ruled *do not adopt*, and specifically *do not adopt for the
  queue*. Re-verified: nothing in this plan needs them. See R6.
- **Anything about `formatArchetype`/fingerprint drift (E8).** Unchanged by 3A.

### 1.4 The four open bugs — confirmed / refuted framing

| Issue | Framing | Verdict |
|---|---|---|
| **#279** — 10-URL batch can't finish in one request | "symptom of no 3A" | **CONFIRMED, and partly already mitigated.** The misleading `export const maxDuration = 300` is **already deleted** (`app/api/analyze/route.ts:9-15` now carries a comment explaining why). The *actual* defect — the sequential `for` loop at `:75-86` running up to 10 × 45–73s inside one POST — is untouched and is exactly what S4 removes. `MAX_URLS_PER_BATCH = 10` carries an owner ruling (2026-08-26) that lowering it was **rejected** "because the real fix is Phase 3A". **#279 closes with S4.** |
| **#287** — counter sits at 0/N | "symptom of no 3A" | **CONFIRMED.** With N job rows the counter becomes a `COUNT(*) WHERE status='succeeded'` — real by construction, not by streaming effort. Closes with S5. Its folded-in P2 (the toast never says which URLs failed, though `failedUrls[]` is returned at `:91`) is FE work that S5 should absorb since the same panel is rewritten. |
| **#290** — progress is structurally fake | "symptom of no 3A" | **CONFIRMED and it is the more accurate ticket of the two.** Verified: `route.ts:77` calls `runAnalysis({ url, prompt, existingId })` with **no `onProgress`**, while the pipeline computes 10 progress steps that reach nobody. `lib/server/analysis/pipeline/progress.ts` is live, tiny and correct — §10.1's "gets wired up rather than deleted" is right. Closes with S5. **But see R4: 3A makes the transport harder, not easier, because progress now originates in a different process.** |
| **#286** — client accepts URLs the server rejects | "3A-scoped?" | **PARTLY — do not force the whole ticket in.** #286 as filed is a *client/server validation parity* bug (prefix-anchored `URL_REGEX` vs anchored server rules) and is independently shippable today. **But 3A has a hard dependency on one specific half of it:** S6's dedupe key needs a **canonical URL normalisation** (`…/reel/X`, `…/reel/X/`, `…/reel/X?utm_source=…` must produce **one** key, or dedupe silently fails and the user double-spends). No canonical normaliser exists today. **Recommendation:** ship #286 first as the shared validator, and have 3A add `normaliseAnalysisUrl()` beside it in the same module. Both are the TR-1 "one canonical derivation" rule applied to URLs. |
| **#316** — two unverified `UPDATE analyses` writes | "bears on E3?" | **Not E3, but it is a 3A prerequisite for a different reason.** It has nothing to do with `transaction()`. It matters because under 3A a silently-dropped 0-row `UPDATE` at `pipeline/index.ts:387` / `:520` becomes **invisible**: today it fails inside a request a human is watching; under a worker it fails into a log nobody reads, and the job still reports `succeeded`. Cheap, well-specified, independent. **Land before the worker.** |
| **#317** — reaper boundary test overclaims "(strict `<`)" | "does the gap matter to 3A?" | **The naming gap does not. What the reaper *is* does — and it is a much bigger problem than #317.** See R1; this is the headline finding of this plan. |

---

## 2. Drift found — the TDD vs the code today

§10 was last edited before 3C, the web deploy, `#295` and the reaper landed. Six of its statements no longer hold.

**D1. `014_jobs.sql` is TAKEN. 3A's migration is `015_jobs.sql`.**
`migrations/` now holds fourteen files; `014_profile_lookup_failure.sql` (ticket #291) exists and is merged.
§10.2, §11.3a E and §15 all still say `014`. **All three are stale.** Per §15's own rule ("no agent picks a
number at implementation time") the number is fixed **here**: **`015_jobs.sql`**. §11.3a E's "a fresh Turso DB
applies 001–013, thirteen files" is also stale — it is now **fourteen**, 001–014.

**D2. The web deploy has LANDED. §11.3a's "Phase: Deploy (now)" is done.**
`Dockerfile` (three-stage, `node:24.14.1-slim`, no external binary, global `tsx`, `migrations/` +
`scripts/migrate.ts` + `lib/server/db.ts` copied in), `railway.json` (`preDeployCommand: npx tsx
scripts/migrate.ts`, `healthcheckPath: /auth/pin`, `restartPolicyType: ON_FAILURE`) and
`next.config.ts` (`output: "standalone"`, `poweredByHeader: false`, site-wide CSP) all exist at `main`.
**3A therefore starts against a real deployed web service, not a green field.** Consequences in P4 and R7.

**D3. A reaper exists — but it is NOT 3A's reaper, and 3A breaks its correctness argument.**
`lib/server/analysis/reaper/` (#313, merged `5332ab9`) reaps stranded **`analyses`** rows at boot. §10.4's reaper
is a **`jobs`** heartbeat reaper. **Two different reapers, two different tables, both needed.** The existing one
carries its own kill switch — see R1. Naming discipline: call 3A's `lib/server/jobs/reaper.ts` and never let a
reader think #313 already did it.

**D4. `maxDuration` is already gone.** §10.1's "`maxDuration = 300` becomes irrelevant" is now retrospective —
it was deleted under #279 and replaced with a comment. Nothing to do.

**D5. The pipeline DELETEs the `analyses` row when a *new* analysis fails.**
`pipeline/index.ts:616-623` — `DELETE FROM analyses WHERE id = ?` on the non-re-analyse error path (the
re-analyse path `UPDATE`s to `failed` instead). §10.2's `analysis_id TEXT REFERENCES analyses(id)` therefore
points at a row that **will not exist** for exactly the jobs a user most wants to inspect. See R3 and Q3.

**D6. `yt-dlp` and ffmpeg are gone (#295).** §11.2b's binary row is moot and §10's worker sizing assumption
("~1GB for download + `yt-dlp` + upload") is now **too pessimistic for YouTube and unchanged for Instagram** —
YouTube video is fetched by Google server-side via `fileData.fileUri`; Instagram still downloads to `/tmp`.
Size the worker from the Instagram path only.

**Still true, re-verified:** §1.5's constraint holds. `grep` for `.transaction(` across `lib/`, `app/`,
`scripts/` returns **one** production hit: `scripts/migrate.ts:660` (`client.transaction("write")`), which is a
one-shot process that exits — the leak is a long-lived-server problem, so this is correct as-is. The
`lib/server/fingerprint` + `app/api/profiles/[id]/fingerprint/route.ts` precedent (PR #120) is intact and
documented in-place. **No `db.transaction()` exists in any long-lived path today. 3A must not be the first.**

---

## 3. Prerequisites

**Ordered. "Blocks 3A" means 3A code must not start until it lands. "3A absorbs" means 3A owns it as its own work.**

### 3.1 Must land BEFORE 3A code starts

| # | Prerequisite | Why it blocks | Blocks which milestone |
|---|---|---|---|
| **P1** | **Re-derive `STRANDED_PENDING_THRESHOLD_MINUTES` / re-scope the #313 analyses reaper for a two-process world.** Its own doc comment names this as its **REVISIT TRIGGER**, verbatim: *"if #279 ever makes batches parallel or moves them to a background worker, a row's pending window stops being bounded by one analysis and this number must be re-derived."* | This is 3A's single highest-severity correctness risk. See R1. | **M1** (before any job row can queue) |
| **P2** | **#316 — assert `rowsAffected` on the last two unverified `UPDATE analyses` writes** (`pipeline/index.ts:387`, `:520`). | A 0-row update becomes invisible under a worker: the job reports `succeeded` while a paid Gemini result was silently discarded. Independent, small, already fully specified. | **M2** (before the worker runs the pipeline unattended) |
| **P3** | **A canonical `normaliseAnalysisUrl()` — the normalisation half of #286.** | S6's dedupe key is `(normalised_url, prompt_hash)`. With no canonical normaliser, `…/reel/X` and `…/reel/X/?utm_source=…` are two keys, the partial unique index never fires, and **idempotency silently does nothing while looking like it works** — the exact class TR-1 exists to forbid. | **M1** (the index is meaningless without it) |
| **P4** | **Decide and document the worker service's Railway config path so it does NOT run `preDeployCommand`.** Railway's pre-deploy command is **per-service** and runs between build and deploy ([docs](https://docs.railway.com/guides/pre-deploy-command)); a monorepo service can point at its own config file but **must give an absolute path — the config file does not follow the service Root Directory** ([docs](https://docs.railway.com/guides/monorepo)). | Today `railway.json` at the repo root runs `npx tsx scripts/migrate.ts`. A second service built from the same root would inherit it and run migrations **concurrently with the web service's deploy**. `scripts/migrate.ts` has **no advisory lock and no cross-process guard** (verified — it has checksum tracking (#277/#278) and a transaction-stripping guard (#307), neither of which is a mutex). | **M5** (worker service creation) — but decide early, it shapes the ticket |

### 3.2 3A absorbs these as its own work

| # | Item | Where |
|---|---|---|
| A1 | `015_jobs.sql` + a schema test row, matching `tests/server/db/migrations.schema.test.ts`'s existing pattern | M1 |
| A2 | Cross-process progress transport (the §10.4 SSE gap — see R4) | M4 |
| A3 | Worker sizing / Serverless-OFF checklist item (§11.2b, re-homed by §11.3a A) | M5 |
| A4 | `NODE_ENV=production`, `APP_SESSION_SECRET`, `TURSO_*` on the worker service — the §11.3a B secret list applies to **both** services, and the worker needs `TURSO_*` most of all | M5 |
| A5 | Deleting the `for` loop and the batch-failure response shape from `/api/analyze` | M3 |

### 3.3 Explicitly NOT prerequisites

- **#317** (reaper test naming). Real, P3, cosmetic to 3A. Fix it whenever; it gates nothing. *(But note the
  reviewer's mutation finding — `<` → `<=` passed all 12 tests — is a live warning about test quality in exactly
  the module family 3A extends. Apply the lesson to 3A's own boundary tests, don't wait on the ticket.)*
- **#286's client/server parity half.** Ship it, but it doesn't block 3A. Only P3's normaliser does.
- **Embedded replicas.** Ruled out (§11.2c C3), re-confirmed.
- **`credits_charged` / spend cap.** §10.4 already says so.

---

## 4. Architecture plan

### 4.1 The shape

```
BEFORE (today)
  POST /api/analyze ──► for (url of urls) { await runAnalysis(url) } ──► 200 after 7–18 min

AFTER (3A)
  POST /api/analyze ──► INSERT N job rows ──► 202 { jobIds[] }        (~10ms)
                                   │
  worker process ── claim ─────────┘──► runAnalysis({..., onProgress}) ──► job succeeded/failed
       │                                          │
       └── heartbeat 15s ──► jobs.heartbeat_at    └── progress ──► jobs.progress_* (see R4)
                                                                        │
  GET /api/jobs/stream?ids=… (web service, SSE) ── polls jobs table ────┘──► browser
```

`runAnalysis()` is untouched. The only new caller is the worker.

### 4.2 Module placement (`lib/server/jobs/`, per §2 and AGENTS.md)

```
lib/server/jobs/
├── index.ts        # barrel — re-exports only
├── types.ts        # JobKind, JobStatus, JobRow, AnalysisJobPayload, ClaimResult
├── constants.ts    # HEARTBEAT_INTERVAL_MS, STALE_JOB_MULTIPLIER, POLL_INTERVAL_MS,
│                   # MAX_ATTEMPTS — all named exports so tests can pin them (#313 precedent)
├── repository.ts   # enqueue(), claim(), heartbeat(), markSucceeded(), markFailed(),
│                   # getJobs() — ALL single statements, NO db.transaction() (§1.5)
├── reaper.ts       # reapStaleJobs() — the JOBS reaper, distinct from
│                   # lib/server/analysis/reaper (see D3)
├── dedupe.ts       # buildDedupeKey(normalisedUrl, promptHash)
└── worker.ts       # runWorkerLoop() — the loop, unit-testable, no process concerns

scripts/worker.ts   # thin entrypoint: imports runWorkerLoop(), wires SIGTERM, exits.
                    # Keep it thin — §10.4.
```

`repository.ts` takes the same **`client: Client = db` default-parameter** shape the reaper established
(`lib/server/analysis/reaper/reaper.ts`), for the same reason: it lets tests drive a real `/tmp` `file:` libSQL DB
without `vi.resetModules()` gymnastics. This is a proven pattern in this repo — reuse it, don't invent one.

### 4.3 The claim — unchanged from §10.3, and binding

```sql
UPDATE jobs
SET status='claimed', claimed_at=datetime('now'), claimed_by=?,
    attempts=attempts+1, updated_at=datetime('now')
WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1)
RETURNING *;
```

Zero rows returned = nothing to claim. **One statement. No `db.transaction()`. Do not "improve" it.** (§1.5 / E3.)
`attempts=attempts+1` on *claim* (not on completion) is deliberate: a worker killed mid-job has already burned its
attempt, so a crash-loop terminates instead of spinning forever.

### 4.4 Schema — `015_jobs.sql`

§10.2's table, with **three additions** the TDD did not anticipate:

```sql
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK(kind IN ('analysis')),
  status       TEXT NOT NULL CHECK(status IN ('queued','claimed','running','succeeded','failed','dead')),
  payload      TEXT NOT NULL,
  dedupe_key   TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,          -- see Q1: 3 may be wrong for paid work
  claimed_at   TEXT, claimed_by TEXT, heartbeat_at TEXT,
  last_error   TEXT,
  analysis_id  TEXT,                                 -- NO FK: see D5 / R3
  progress_step    TEXT,                             -- NEW (A2): cross-process progress
  progress_message TEXT,                             -- NEW (A2)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_jobs_dedupe ON jobs(dedupe_key)
  WHERE status IN ('queued','claimed','running');
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX idx_jobs_heartbeat ON jobs(status, heartbeat_at);   -- NEW: the reaper scan
```

Wrap in `BEGIN TRANSACTION; … COMMIT;` exactly once, per `scripts/migrate.ts`'s stripper contract — and note the
#307 trap it documents: a block opened with bare `BEGIN;` or closed with `END;` is **not** recognised. Use the
literal `BEGIN TRANSACTION;` / `COMMIT;` pair.

**Why `analysis_id` drops the foreign key (change from §10.2):** D5. The pipeline deletes the `analyses` row on a
failed *new* analysis. A real FK would either block that delete or (with `ON DELETE SET NULL`) erase the only
forensic link. Keep it a plain nullable column, populated when known.

### 4.5 The route (S4)

`POST /api/analyze` keeps every existing guard verbatim — auth, `urls` array shape, `MAX_URLS_PER_BATCH`,
string-type check, the `existingId` + batch rejection, and the `analysisExists()` pre-check (#312). It then
replaces the loop with N `enqueue()` calls and returns **`202`** with `{ jobIds, deduped: [...] }`.

**The `existingId` pre-check must stay where it is.** It is a cheap read that prevents a paid run against a
deleted row (#312), and moving it into the worker would re-open the window it closed.

### 4.6 Testing posture

Follow the #313/#315 precedent, which this repo has already paid for:

- Real `/tmp` `file:` libSQL DB via the injected client — **not** mocks. Verify by execution.
- **Every assertion gets a named test that goes red when the assertion is deleted**, and the ticket reports which
  test kills which mutation (#316's acceptance criteria, and the lesson of #317's `<` → `<=` mutation survival).
- Boundary tests must **not** claim to pin an operator they cannot discriminate (#317). Describe what they prove.

---

## 5. Risk register

| ID | Risk | Sev | Mitigation |
|---|---|---|---|
| **R1** | **The #313 analyses reaper marks live worker jobs `failed`.** Its correctness argument is *"a freshly booted process has no in-flight analyses of its own, so any `pending` row it sees was written by a process that is gone."* **Under 3A that sentence is false.** The web service and the worker are separate processes: a web deploy/restart (frequent — `restartPolicyType: ON_FAILURE`, plus every push) boots a process that sees rows the *worker* is legitimately still working on. The 30-minute age guard was sized on "one analysis, 45–73s" and explicitly **not** on queue wait — but under 3A a job queued behind nine others can sit `pending` far past 30 minutes while perfectly healthy. Outcome: a paid, in-flight analysis is marked `failed` and shown to the user as a failure; if the pipeline later completes it silently flips back to `completed`, so the user sees a failure that "un-fails". | **HIGH — this is the highest-severity item in this plan** | **P1, before any job row exists.** Two options, owner's call (Q2): (a) gate the reaper on `jobs` — only reap a `pending` analysis whose owning job is terminal or stale; (b) gate it on a worker-liveness/heartbeat check. Do **not** just raise the constant — that hides the problem and re-breaks the moment the queue is deep. The reaper's own REVISIT TRIGGER comment must be updated in the same change, or the next reader trusts a note that is no longer true. |
| **R2** | **`@libsql/client` transaction leak (§1.5, §13 E3).** A job queue is exactly the code that reaches for `transaction()`; `Sqlite3Transaction.close()` is a no-op after a successful commit and there is no userland fix. Unbounded handle growth under a long-lived server — and the worker is the longest-lived process we will ever run. | **HIGH (probability), contained** | Already contained by design: §10.3's single-statement claim, and the PR #120 precedent. **Re-verified: zero `db.transaction()` calls exist in any long-lived path today.** Enforce structurally, not by review: (1) every `repository.ts` function is one `execute()`; (2) a test that greps `lib/server/jobs/` for `.transaction(` and fails — cheap, and it is the only thing that survives a future contributor who "cleans up" the claim. Add the same in-file comment the fingerprint repository carries. |
| **R3** | **Retry burns credits.** `max_attempts = 3` on a job whose every attempt makes paid ScrapeCreators + Gemini calls. A job that fails *after* the Gemini call (e.g. a persist error, or the prose guard — E7/OR-25 fails loudly on a paid call **by design**) would be retried twice more at full cost. Compounded by D5: a failed new-analysis **deletes its `analyses` row**, so retry #2 starts clean and re-spends everything. | **HIGH (cost), MED (correctness)** | Q1 — owner decision. My recommendation: **`max_attempts = 1` for `kind='analysis'` until `credits_charged` tracking exists.** Retry is only safe when the failure class is known to be transient, and today we cannot distinguish "network blip" from "prose guard rejected a paid generation". A `dead` status with `last_error` and a manual re-run button is honest; silent 3× spend is not. Keep the column at default 3 so the knob exists — set the *enqueue* value to 1. |
| **R4** | **SSE cannot see the worker's progress. §10.4 has a gap.** It says *"Progress transport: SSE — fine on a long-lived Node process"* — true, but it silently assumes one process. Progress originates in the **worker**; the SSE connection terminates in the **web** service. libSQL/Turso has **no pub/sub**, and Railway private networking between two services is not a message bus. Without a decision here, #290 is "fixed" by wiring `onProgress` into a callback whose output can never reach the browser. | **MED — will be discovered late and hurt** | Adopt the DB-as-transport shape in §4.4: the worker writes `progress_step` / `progress_message` on its existing 15s heartbeat write (**no extra write**), and the web service's SSE route polls the `jobs` rows for the requested IDs every 1–2s and pushes changes. Cost is a handful of tiny indexed reads/sec at ~70ms (§11.2c C2) — noise against a 45–73s analysis. **The per-URL counter (#287) does not even need this** — it is `COUNT(*)` over the job rows. Step-level granularity (#290) does. Ship the counter first; treat step granularity as separable. |
| **R5** | **Idempotency silently no-ops.** The partial unique index is only as good as `dedupe_key`. With no canonical URL normaliser (P3), the same reel pasted with and without tracking params produces two keys, two jobs, two paid runs — and the index looks like it is protecting us. Same failure class as #286 and the TR-1 rule. | **MED** | P3 first. Then test the index **by execution** against a real libSQL DB with the exact URL variants from #286's differential table (trailing slash, `?utm_source=`, `igsh=`), asserting the second `enqueue()` returns the existing job rather than inserting. A test that only tries two identical strings passes vacuously (E6's lesson). |
| **R6** | **Cross-instance replica staleness** — if anyone adopts embedded replicas, two Railway services each hold their **own** replica and a worker would not see a newly-enqueued job until its next `sync()`. | **LOW (already ruled), HIGH if ignored** | Already ruled: §11.2c C3, *do not adopt, and specifically not for the queue*. Re-confirmed against the code — `lib/server/db.ts:7` is a plain `createClient({ url, authToken })` with no `syncUrl`, which routes to the HTTP/hrana client. **Record it in `lib/server/jobs/` as a comment**, because the tempting "fix" for R4's polling latency is exactly the thing that breaks the queue. |
| **R7** | **Both services run `preDeployCommand` → concurrent migrations.** `railway.json` at the repo root sets `preDeployCommand: npx tsx scripts/migrate.ts`; pre-deploy is per-service and the config file path does not follow the Root Directory. `scripts/migrate.ts` has checksum tracking (#277/#278) and a transaction guard (#307) but **no lock**. Two concurrent runs against a fresh Turso DB is an untested race. | **MED** | P4. Give the worker service its own config (absolute path) or dashboard settings with **no** pre-deploy command — web owns migrations, worker never migrates. Make this an explicit **checked item** on the worker-service ticket, sitting next to the Serverless-OFF check. |
| **R8** | **Serverless flipped ON for the worker silently kills 3A.** §11.2b names this as "the one setting that would silently break 3A". The worker has no inbound HTTP, so a sleep heuristic would consider it idle forever. | **MED** | Railway's Serverless is **off by default and per-service** ([docs](https://docs.railway.com/guides/optimize-usage)) — we simply never enable it. §11.3a A already re-homes this check onto 3A's final ticket. Keep it a literal checkbox, not prose. |
| **R9** | **Dangling `analysis_id` (D5).** Job `failed` → `analyses` row deleted → the job's only pointer to what happened is `last_error`. A user asking "what happened to URL 4?" gets a job row with no analysis. | **MED** | Drop the FK (§4.4). Persist a useful `last_error`. Then Q3: decide whether 3A should stop the pipeline deleting failed new-analysis rows. My read: the delete predates the "never delete analyses" ruling that #313 was built under, and the two now sit awkwardly together — worth an explicit ruling rather than inheriting it. |
| **R10** | **Worker sizing is now unknown, not conservative (D6).** §10/§11's ~1GB estimate assumed `yt-dlp` + local video download. YouTube no longer downloads at all; Instagram still does. Railway meters RAM at $10/GB/mo and vCPU at $20/vCPU/mo (§11.2a) — over-provisioning a 24/7 worker is the one line item that moves the owner's "predictable flat floor" (OR-23). | **LOW** | Start the worker **small** and read Railway's own per-service metrics before sizing up. Do not carry §10's pre-#295 number into the ticket as if it were measured. |
| **R11** | **CSP vs SSE.** `next.config.ts` sets a site-wide `connect-src 'self'`. | **INFO — no action** | Verified: an SSE `EventSource` to a same-origin `/api/...` path satisfies `connect-src 'self'`. **No CSP change needed**, and none should be made. Recorded so a debugging session doesn't loosen the policy that #283 just landed. |
| **R12** | **The web service still holds `runAnalysis()` after the flip.** Once `/api/analyze` only enqueues, the pipeline is still imported and reachable in the web image. | **LOW** | Acceptable and arguably useful (single-URL fallback). But do **not** leave a second live entry point that bypasses the queue and its dedupe — if it stays, it must be unreachable from any route. Decide explicitly in M3; don't let it become accidental. |

---

## 6. Open questions — owner decisions needed

**Ticket-cutting should not start until Q1, Q2 and Q3 are answered.** Q4–Q5 can be answered during M1.

- **Q1 — Retry policy for paid work (R3). BLOCKING.**
  §10.2 defaults `max_attempts = 3`. Every attempt spends real ScrapeCreators + Gemini credits, and there is no
  `credits_charged` tracking to notice it. **Recommendation: enqueue analysis jobs with `max_attempts = 1`**
  until spend tracking exists; keep the column so it is one value to change later. **Owner: accept, or accept
  3 retries with the spend consequence stated?**

- **Q2 — What happens to the #313 analyses reaper under two processes (R1)? BLOCKING.**
  Option (a) gate reaping on the owning `jobs` row's state; option (b) gate on worker liveness; option (c)
  raise the threshold (**not recommended** — hides it, re-breaks on a deep queue).
  **Recommendation: (a).** Once jobs exist they are the authoritative record of "is this in flight", which is
  precisely the fact the reaper is currently guessing at from a timestamp.

- **Q3 — Should 3A stop the pipeline DELETEing failed new-analysis rows (D5/R9)? BLOCKING-ish.**
  The standing ruling quoted on #313 is *"never delete analyses / no backfill"*, yet `pipeline/index.ts:616`
  deletes on the new-analysis failure path. Under 3A this becomes visible: a failed job points at nothing.
  **This is a product question (does a failed analysis leave a visible row?), not purely technical.** If the
  answer is "leave a `failed` row", it is a small pipeline change that should land **with** 3A, not after.

- **Q4 — Progress fidelity (R4).** Do we ship (i) a real N-of-M **counter** only (closes #287, near-zero cost,
  no SSE at all — the existing poll would do), or (ii) counter **plus** per-URL step names like
  "downloading / uploading / analyzing" (closes #290 fully, needs the SSE route + `progress_*` columns)?
  **Recommendation: build (i) in M3 and (ii) in M4 as separable milestones**, so the user-visible lie is fixed
  early even if step streaming slips.

- **Q5 — Does `MAX_URLS_PER_BATCH` move once 3A ships?** The constant's comment says it is "a cost/fairness
  knob, not a timing one" and was left at 10 "until 3A ships". 3A removes the timing constraint entirely.
  **Recommendation: leave it at 10** and revisit only alongside the spend cap — raising the batch size before
  spend tracking exists moves the wrong lever first. Confirm.

- **Q6 — Non-blocking, for the record.** #279, #287 and #290 all become closable by 3A. Confirm they close
  **with 3A's milestones** rather than being worked separately in the meantime — three parallel fixes to
  `/api/analyze` would collide with M3.

---

## 7. Phased build order — milestone sketch

Not tickets. These are the seams I would cut tickets along, in dependency order.
**[BE]/[FE] marked. Roughly one PR per milestone except M1 and M4.**

| M | Milestone | Type | Depends on | Notes |
|---|---|---|---|---|
| **M0** | **Prerequisites** — P1 (reaper re-scope, needs Q2), P2 (#316), P3 (URL normaliser / #286), P4 (worker config decision) | BE | Q1–Q3 answered | P2, P3 are independent of each other and **can run in parallel**. P1 depends on Q2. |
| **M1** | **Schema + repository.** `015_jobs.sql`, schema test, `lib/server/jobs/{types,constants,repository,dedupe}.ts`, `reaper.ts`. No caller yet. | BE | M0 (P3 for dedupe) | The whole 3A surface is testable here against a `/tmp` file DB with **zero** paid calls and zero user-visible change. Highest test value per unit of risk — front-load it. |
| **M2** | **Worker loop + entrypoint.** `worker.ts` (`runWorkerLoop()`), `scripts/worker.ts`, heartbeat, SIGTERM drain. Runs locally against manually-inserted job rows. **Nothing enqueues yet.** | BE | M1, P2 | Shadow milestone: the worker exists and is exercised before anything depends on it. |
| **M3** | **Flip the route.** `/api/analyze` → `202` + job IDs. Job status read endpoint. FE: real N-of-M counter + render `failedUrls`. | BE + FE | M2 | **Closes #279 and #287.** BE must ship the endpoint contract before FE. This is the user-visible cutover — the riskiest merge. |
| **M4** | **Step-level progress.** `progress_*` columns wired via heartbeat, SSE route, FE `EventSource`. | BE + FE | M3, Q4=(ii) | **Closes #290.** Separable — if Q4 answers (i), M4 is deferred and nothing else changes. |
| **M5** | **Worker Railway service.** Second service from the same repo/Dockerfile, custom start command, **Serverless OFF**, **no pre-deploy command** (R7), secrets per §11.3a B, sizing per R10. | BE / infra | M2 (entrypoint must exist — §11.3a A) | §11.3a A's "as its final ticket". Until this lands, 3A is complete but not running in production. |

**Parallelism for the PM:** M0's P2/P3 run in parallel. M1→M2→M3 is a strict chain. M4 and M5 are independent of
each other once M3 lands. FE work exists only in M3 and M4 and is blocked on the BE contract in both.

**One sequencing warning.** M3 is the point of no return: once the route returns `202`, the app is broken for
users until M5 stands the worker up in production. **Either M3 and M5 ship close together, or M3 ships behind a
flag.** §11.3a A's ordering (worker service last) is right for *building*, but it must not be read as
"deploy M3 and wait" — do not merge M3 to production without M5 queued immediately behind it.

---

## 8. Summary for the owner

- **3A's design is still sound.** §10.1's core claim — *changes who calls `runAnalysis()`, not what it does* —
  survives verification. The pipeline is already worker-shaped.
- **Six factual drifts** since §10 was written; the load-bearing ones are **`014` is taken (→ `015_jobs.sql`)**,
  **the web deploy has landed**, and **a reaper exists that is not this reaper**.
- **The biggest risk is R1**, and it is not the one the TDD predicted. §13 called E3 (the transaction leak) *"the
  highest-probability way 3A ships a production defect"*. E3 is real but **already contained by design and
  verified clean at `main`**. The uncontained one is the #313 analyses reaper: 3A invalidates the premise it was
  built on, and the module's own REVISIT TRIGGER comment predicted exactly this.
- **Three owner decisions block ticket-cutting:** Q1 (retry vs credits), Q2 (reaper under two processes),
  Q3 (deleting failed analysis rows).

---

---

## 9. Owner rulings and the resulting tickets (2026-09-09)

### 9.1 Rulings — settled, do not re-litigate

- **Q1 — Retry.** `max_attempts = 1` for analysis jobs. Multi-attempt retry is a documented **future** prerequisite gated on `credits_charged` spend tracking; it is not part of 3A. The column stays so the knob exists.
- **Q2 — Reaper (R1).** Option **(a)**: gate the #313 `analyses` reaper on the `jobs` table. **Rejected: raising `STRANDED_PENDING_THRESHOLD_MINUTES`** — it hides the problem and re-breaks on a deep queue.
- **Q3 — Failed jobs.** **Keep** the pipeline's `DELETE` of the `analyses` row on new-analysis failure (`pipeline/index.ts:616`). No "visible failed row" feature. This does not conflict with the "never delete completed analyses" rule — it applies only to jobs that never produced a completed analysis. The forensic record is the job's `last_error`.
- **Q4 — Progress fidelity.** **(ii)** — counter (M3) *and* per-URL step names (M4). Shipped as separable milestones.
- **Q5 — `MAX_URLS_PER_BATCH`.** Stays at 10. Revisit only alongside the spend cap. No ticket.
- **Q6 —** #279 / #287 / #290 close with 3A's milestones; no parallel fixes to `/api/analyze`.
- **Q7 — M3 sequencing (§7 warning). Owner ruling 2026-09-09: Option A, no flag.** #356 merges unflagged and #360 (the worker service) is queued immediately behind it. The short window where production analyses do nothing between the two merges is accepted. **Rejected: the env-gated inline/enqueue switch (Option B)** — more code, and it leaves a second live entry point that bypasses the queue and its dedupe (R12).

### 9.2 Ticket map

| Ticket | Milestone | Depends on |
|---|---|---|
| #350 [BE] `normaliseAnalysisUrl()` (P3, normalisation half of #286) | M0 | none |
| #351 [BE] `015_jobs.sql` + schema test (A1) | M1a | none |
| #352 [BE] `lib/server/jobs/` types/constants/dedupe/repository | M1b | #350, #351 |
| #353 [BE] `lib/server/jobs/reaper.ts` — `reapStaleJobs()` | M1c | #352 |
| #354 [BE] Gate the #313 analyses reaper on `jobs` (P1 / R1) | M0/M1 | #351, #352 — **must precede #356** |
| #355 [BE] `runWorkerLoop()` + `scripts/worker.ts` | M2 | #352, #353, **#316** |
| #356 [BE] `/api/analyze` → `202`, `GET /api/jobs` (closes #279) | M3a | #355, #354 — unblocked by Q7, see 9.3 |
| #357 [FE] Real N-of-M counter + failure reasons (closes #287) | M3b | #356 |
| #358 [BE] `GET /api/jobs/stream` SSE (A2 / R4) | M4a | #356, #355 |
| #359 [FE] `EventSource` step progress (closes #290) | M4b | #358, #357 |
| #360 [BE] Railway `worker` service (P4/R7, R8, R10) | M5 | #355 — **ship with/behind #356** |

**Existing tickets referenced, not duplicated:** **#316** is a hard prerequisite for #355. **#286**'s validation-parity half stays on #286 and blocks nothing. **#317** is explicitly not a prerequisite.

### 9.3 RESOLVED — the §7 sequencing question (owner ruling 2026-09-09)

The question was: **does #356 ship behind a flag, or unflagged with #360 immediately behind it?** The two produce different code, and the web service is live, so it could not be guessed at implementation time.

**Ruled: Option A — no flag** (see Q7 in §9.1). Consequences, binding on both tickets:

- #356 ships no env-gated inline/enqueue switch. R12 still applies: no second live HTTP entry point may bypass the queue and its dedupe.
- #360 must be picked up **immediately after #356 merges — same session/day, not "eventually."** #356's PR description must say so.
- #356 and #360 both drop `blocked` and carry `ready-for-agent`. #360's other gates (its own dependency on #355, and the standing "no Railway operations without the owner's go-ahead" constraint) are unchanged by this ruling.

---

*Authored by **John (tech lead)**, running on **Opus** at the owner's explicit request. **2026-09-09.***
*Planning + ticket-cutting only — no application code modified, no external API calls made, no Railway
infrastructure touched.*
