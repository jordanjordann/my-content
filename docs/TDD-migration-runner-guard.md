# TDD — Runner-level migration safety guard

**Status:** approved design, not yet implemented
**Owner ruling:** 2026-08-27, option B — "stop hardening `012` from the inside; the runner should refuse to re-apply a destructive migration to a non-empty database."
**Author:** John (tech lead)
**Supersedes:** the in-file `DELETE FROM analyses WHERE schema_version ...` guard in `migrations/012_performance_block.sql` added by PR #305 (to be reverted, see §7)
**Related:** #277 (atomic recording), #278 (checksums), PR #305

---

## 1. Problem restated precisely

`scripts/migrate.ts` runs as Railway's `preDeployCommand` against the production Turso DB. `_migrations`
is keyed by **filename only**. PR #305 correctly closes the *crash* window (migration body and its
tracking row now share one transaction) and adds a checksum that fails the deploy if an already-applied
`.sql` file is edited. Neither closes the **re-presentation** window:

| # | Scenario | `_migrations` state | Result today |
|---|---|---|---|
| H1 | `012_performance_block.sql` renamed to a *lower or equal* sort key (e.g. `012_performance_block_v2.sql`) | 001–014 tracked | New name looks brand-new → 012 re-runs against live data |
| H2 | Renamed to a *higher* sort key (e.g. `015_perf.sql`) | 001–014 tracked | Same |
| H3 | `_migrations` lost and restored from an older backup, app data still at 014 | 001–011 tracked | 012, 013, 014 all "pending" → 012 re-runs against live data |

Re-running 012 costs, as demonstrated by review round 2 against a real local chain:

1. `DELETE FROM analyses;` wipes the corpus (unguarded form), **and**
2. the table rebuild 30 lines below copies rows forward with all 17 `perf_*` columns hard-coded `NULL`,
   so even a row that survives a guard comes out as an empty shell, **and**
3. 012's narrower `perf_unavailable_reason` CHECK replaces 013's widened one while `_migrations` still
   reports 013 applied — so `REACH_NOT_ON_FIRST_SLIDE` is permanently rejected by a DB that reports
   itself fully migrated, with no self-healing path.

Three review rounds each found a new hole in defending 012 *from inside 012*. That is the signal that
the fix is at the wrong level. The guard moves into the runner, where it protects every migration —
including the ones nobody has written yet.

---

## 2. Pressure-testing the owner's shorthand

The shorthand is a good instinct but not a spec. Three of its four nouns need work.

### 2.1 "destructive" — do not classify SQL statically; **measure the effect**

Two obvious options, both rejected:

- **Static scan** (`grep` the `.sql` for `DELETE` / `DROP` / `ALTER`). Rejected: 012's danger is a
  `CREATE TABLE … INSERT … SELECT … DROP … RENAME` rebuild. A `DELETE`-scan catches the wrong line, and
  a `DROP`-scan false-positives on every one of the repo's five *safe* rebuild migrations (004, 005,
  009, 012, 013 all `DROP TABLE`). Static classification of SQL is guesswork dressed as a rule.
- **In-file opt-in marker** (`-- @destructive` header). More honest, but it relies on the author of the
  next destructive migration *remembering* to mark it — which is exactly the failure mode of asking 012
  to defend itself. A safety net that the dangerous case must volunteer for is not a safety net.

**Chosen: behavioural detection.** #277 already runs each pending migration inside an interactive
transaction the runner owns. Inside that same transaction, take a row-count snapshot of every user
table **before** the body executes and **after** it executes, and compare — then decide whether to
commit or roll back. Destructiveness stops being a property we guess about the text and becomes a
fact we observed about the run.

Validated locally (throwaway `file:` libsql DB, real `migrations/` chain, one seeded
`schema_version = 3` row with a full perf block):

```
BEFORE: {"settings":0,"profiles":0,"profile_style_fingerprints":0,"analyses":1}
AFTER : {"settings":0,"profiles":0,"profile_style_fingerprints":0,"analyses":0}
DETECTED ROW LOSS IN: [ 'analyses' ]
after rollback, rows still: 1
perf intact: {"perf_reach_value":12345,"performance_score":99}
```

The rebuild is caught, and the rollback restores the row *and its perf block* intact.

Honest limits, stated up front so nobody assumes more than this buys:

- It detects **row loss**, not **column blanking**. A migration that keeps a row but nulls its columns
  passes. This is precisely why the in-file 012 guard is removed (§7): with the guard in place 012
  re-runs at count 1 → 1 and the tripwire never fires while the perf block is destroyed anyway. With
  the guard gone, 012 re-runs at 1 → 0 and the tripwire fires. Removing the half-measure is what makes
  the runner-level check effective.
- A future *legitimately* destructive migration will trip it. That is the correct default; it takes one
  env var to proceed (§2.3), and being told "this migration is about to delete 412 analyses" before it
  happens is the entire point.
- Cost: one `SELECT COUNT(*)` per user table per **pending** migration. Steady-state production has
  zero pending migrations, so steady-state cost is zero. A fresh setup pays 14 × ~4 counts against
  empty tables.

### 2.2 "non-empty" — every user table, no human picks favourites

"Non-empty `analyses`" would hard-code today's fear into a general mechanism. Instead: the snapshot
covers **every table in `sqlite_master` where `type='table'` and `name NOT LIKE 'sqlite_%'` and
`name <> '_migrations'`**. `_migrations` is the runner's own bookkeeping and is excluded by definition —
the runner writes to it inside the same transaction.

A table that exists before and not after (a genuine `DROP`) counts as dropping to zero. A table created
by the migration has no "before" entry and is ignored.

"Non-empty" therefore needs no separate definition: a table with zero rows before cannot lose rows, so
a fresh database never trips anything. The check is self-scoping.

### 2.3 "refuse" — refuse by default, with a named, discoverable escape hatch

A blanket refusal that strands a 2am deploy with no way forward is a worse failure than the one it
prevents. But a blanket `ALLOW_DESTRUCTIVE=true` is also wrong: set once for 012, it silently authorises
every future destructive migration too.

**Escape hatch: `ALLOW_DESTRUCTIVE_MIGRATIONS` — a comma-separated list of exact filenames.**

- `ALLOW_DESTRUCTIVE_MIGRATIONS=012_performance_block.sql` allows *that one file* to lose rows, once,
  on this run. It does not authorise `015_whatever.sql`.
- Anything not on the list still aborts, even in the same run.
- Also readable as a CLI flag `--allow-destructive=<file>` for local runs, so a developer resetting a
  local DB never has to touch env vars.
- The owner deploys **manually** (standing ruling OR-6 — nothing here proposes automating deploys).
  The flow is: deploy fails → read the error → set the variable in Railway naming the exact file →
  redeploy manually → unset it.

**Discoverability is a design requirement, not a nicety.** The thrown error must contain, in this order:

1. The migration filename.
2. Per affected table: `analyses: 412 rows -> 0 rows (-412)`.
3. `Nothing has been committed. The transaction was rolled back; the database is unchanged.`
4. The literal opt-in string to set, spelled out: `ALLOW_DESTRUCTIVE_MIGRATIONS=012_performance_block.sql`
5. A plain-language "if you did not expect this migration to delete data, do **not** set that variable —
   this is very likely a renamed or re-presented migration; see docs/RUNBOOK.md § Migrations."

### 2.4 Is filename-keying the real bug? — partly, and there is a cheaper fix than re-keying

Yes, filename-keying is the root of H1/H2. No, the answer is **not** to re-key `_migrations` on a
content hash or an in-file immutable ID:

- **Content-hash as primary key directly contradicts #278.** If identity *is* the content, then every
  edit to an applied migration makes it a new, unapplied migration — the runner would re-run it instead
  of failing loudly. That is the exact bug #278 exists to fix, reintroduced from the other side.
- **In-file immutable ID** (`-- @id: 2026-03-11-perf-block`) relies on author discipline, same weakness
  as the destructive marker, and needs a backfill for 14 existing files.

**Better primitive: keep filename as the key, and use the checksum #278 already stores as a secondary
identity index.** Two cheap, exact checks fall out, neither of which guesses at anything:

- **Check A — order regression.** A pending file whose name sorts **before** the maximum already-applied
  name is a regression: someone re-added, restored, or renamed an old migration. Pure string comparison,
  zero false positives against a normally-growing `migrations/` directory. Catches **H1**.
- **Check B — content identity.** A pending file whose checksum equals a checksum already recorded in
  `_migrations` under a **different name** is provably the same migration under a new name. Catches
  **H2**, including the rename-to-a-higher-number case that Check A misses. Free, given #278.

Neither catches **H3** (bookkeeping restored from an old backup) — the checksum row was lost along with
everything else, and the files are in order. Only the behavioural check in §2.1 catches H3.

**Verdict:** order-regression detection is *better than the owner's shorthand for the rename cases* —
more precise, no SQL classification, no author discipline. It is **not a replacement** for it, because
it is blind to H3, which is the disaster-recovery scenario where the stakes are highest. Ship all three;
they are cheap and they cover disjoint holes.

---

## 3. Design

Three preflight/inflight checks in `scripts/migrate.ts`. All three abort the deploy; A and B abort
before anything runs, C aborts inside the migration's own transaction with a rollback.

```
runMigrations(client, migrationsDir)
  ├─ ensureMigrationsTable                      (unchanged, #278)
  ├─ PREFLIGHT (new) — runs once, before the apply loop:
  │    ├─ Check A: order regression
  │    └─ Check B: checksum known under another name
  └─ for each file:
       ├─ already tracked? → checksum compare / adopt   (unchanged, #278)
       └─ pending:
            tx = client.transaction("write")
            ├─ before = snapshotRowCounts(tx)           (new)
            ├─ tx.executeMultiple(strippedBody)         (unchanged, #277)
            ├─ after  = snapshotRowCounts(tx)           (new)
            ├─ Check C: diff(before, after) → losses    (new)
            │    └─ losses AND file not opted-in → tx.rollback(); throw
            ├─ tx.execute(INSERT INTO _migrations ...)  (unchanged, #277)
            └─ tx.commit()
```

### 3.1 New exported helpers (all in `scripts/migrate.ts`, all unit-testable in isolation)

```ts
export interface TableRowCounts { [table: string]: number }
export interface RowLoss { table: string; before: number; after: number }

// Every user table, excluding sqlite_* internals and _migrations.
export async function snapshotRowCounts(executor: Transaction | Client): Promise<TableRowCounts>

// Tables present in `before` whose count decreased (a dropped table counts as -> 0).
export function diffRowCounts(before: TableRowCounts, after: TableRowCounts): RowLoss[]

// Parses ALLOW_DESTRUCTIVE_MIGRATIONS / --allow-destructive into a Set<string>.
// Trims whitespace, ignores empty entries, is case-sensitive on filename.
export function parseDestructiveAllowlist(env: NodeJS.ProcessEnv, argv: string[]): Set<string>

// Check A + Check B. Throws on violation; returns void.
export function assertNoOrderRegression(pendingFiles: string[], appliedNames: string[]): void
export function assertNoRenamedMigration(
  pending: { file: string; checksum: string }[],
  applied: { name: string; checksum: string | null }[],
): void

// Formats the Check C abort message (§2.3 items 1-5). Pure, so its wording is testable.
export function formatDestructiveMigrationError(file: string, losses: RowLoss[]): string
```

`snapshotRowCounts` must accept the **transaction**, not the client — a snapshot taken on the client
would read outside the transaction and miss the uncommitted effect. This is load-bearing.

### 3.2 `_migrations` bookkeeping

No schema change beyond #278's `checksum TEXT`. Check B reads `SELECT name, checksum FROM _migrations`.
Rows with `checksum IS NULL` (legacy, pre-#278) are skipped by Check B — they carry no identity to match
against. This means Check B is inert on the very first deploy after #278 ships and fully effective from
the second deploy onward. Call this out in the RUNBOOK rather than pretending otherwise.

### 3.3 Interaction with the existing orphan warning

PR #305 already warns when `_migrations` has a row with no matching file. Check B upgrades exactly that
situation from a `console.warn` nobody reads in a deploy log to a hard abort — **when** the orphaned
row's checksum matches a pending file. Keep the warning for the case where it does not match (a genuinely
deleted migration).

---

## 4. File tree changes

| Path | Action |
|---|---|
| `scripts/migrate.ts` | **Modify** — add §3.1 helpers, preflight block, in-transaction snapshot/diff/abort |
| `tests/server/db/migrate.test.ts` | **Modify** — add §6 suites; delete the two inline-SQL "guard semantics" tests and the 012-guard headline test, which describe a guard that no longer exists |
| `migrations/012_performance_block.sql` | **Modify** — revert to `main`'s unconditional `DELETE FROM analyses;` (§7) |
| `docs/RUNBOOK.md` | **Modify** — new "§ Migrations — the destructive-migration guard" section: what trips it, the exact error, the env var, the manual-deploy recovery flow, and Check B's first-deploy blind spot |
| `docs/TDD-migration-runner-guard.md` | This file |

No new migration file. `_migrations` is the runner's own bookkeeping; nothing here touches app schema.

---

## 5. Failure modes this design accepts (write these down, do not discover them in round 4)

1. **Column blanking with no row loss is not detected.** §2.1. Mitigated for 012 by reverting the
   in-file guard; not mitigated in general.
2. **Check B is blind on the first deploy after #278**, because every stored checksum is still `NULL`.
   §3.2.
3. **A rename to a higher number *with edited content*** defeats both A and B. At that point a human has
   deliberately authored a new, different migration file — indistinguishable from writing `015_wipe.sql`
   by hand. Check C still covers the data loss; code review covers intent.
4. **`COUNT(*)` is a full scan.** Irrelevant at this app's scale and only paid for pending migrations,
   but it is not free forever.
5. **A migration that legitimately deletes rows now requires an env var.** Intended.

---

## 6. Testing standard — mandatory, and stricter than what PR #305 shipped

Review round 2 proved the current tests are hollow: the "guard semantics" tests assert against a
**hand-written inline copy** of the SQL, so mutating the real `migrations/012_performance_block.sql` to
something that defeats its own purpose still gave **35/35 green**. And the headline test asserted
`SELECT id … toHaveLength(1)` — the row existed, so it passed while its entire perf block was `NULL`.

Every test below is binding on the implementer:

1. **No inline SQL copies of any migration, anywhere, ever.** Every integration test reads the real
   `migrations/` directory via the same `readdirSync` path production uses. If a test needs a mutated
   migration, it copies the real directory to a `tmpdir`, mutates the copy on disk, and points
   `runMigrations` at the tmpdir. It never retypes SQL into the test file.
2. **Assert on row *contents*, never on row existence.** A survival assertion must read back the actual
   business columns — for 012 that means `perf_reach_value`, `perf_multiplier`, `performance_score`,
   `perf_unavailable_reason` — and compare exact values, not `toHaveLength`.
3. **Assert on schema, not just data, wherever a migration rebuilds a table.** At least one test must
   attempt `INSERT ... perf_unavailable_reason = 'REACH_NOT_ON_FIRST_SLIDE'` after the scenario and
   assert it **succeeds** — that is the direct probe for 013's widened CHECK having been reverted.
4. **Every check must be mutation-tested, and the mutation must be recorded in the PR body.** For each
   of A, B, C: disable the check in the real source, show the named test goes red, restore, show green.
   A check with no red-on-removal proof is not covered.
5. **Local throwaway databases only.** `file:` libsql in `tmpdir`, deleted in `afterEach`. Zero network,
   zero ScrapeCreators credits, no `TURSO_*` env usage. Any test that could reach a remote is a bug.

### 6.1 Required scenarios

| Scenario | Setup | Assertion |
|---|---|---|
| Fresh DB, full real chain | empty file DB, real `migrations/` | 14 applied, no check trips, final schema correct |
| **H1 rename, low sort key** | real chain applied + seeded schema-3 row with full perf block; copy dir to tmp, rename `012_*` → `012_performance_block_v2.sql` | Check **A** throws; error names both files; **row and every `perf_*` value unchanged**; `REACH_NOT_ON_FIRST_SLIDE` still insertable |
| **H2 rename, high sort key** | same, renamed to `015_perf.sql` | Check **B** throws naming `012_performance_block.sql` as the original; same content + CHECK assertions |
| **H3 bookkeeping rollback** | real chain applied + seeded row; `DELETE FROM _migrations WHERE name >= '012'` | Check **C** throws; message names `analyses` and `1 -> 0`; **transaction rolled back — perf block intact, 013 CHECK still widened** |
| H3 with opt-in | as above + `ALLOW_DESTRUCTIVE_MIGRATIONS=012_performance_block.sql` | proceeds; `analyses` is empty afterwards (the destruction is *allowed*, and the test says so out loud) |
| Opt-in is per-file | H3 setup, allowlist naming a *different* file | still throws |
| Empty DB never trips C | fresh DB, real chain | no abort, despite 012 containing `DELETE FROM analyses;` |
| 008 on fresh DB | fresh DB | 008's `DELETE FROM analyses WHERE schema_version IS NULL` deletes 0 rows → no trip |
| Snapshot reads inside tx | unit | `snapshotRowCounts(tx)` sees uncommitted inserts made on `tx`; the same call on the client does not |
| Allowlist parsing | unit | `"a.sql, b.sql"` → `{a.sql, b.sql}`; `""` → empty; CLI flag equivalent; unknown names ignored |
| Error message contents | unit on `formatDestructiveMigrationError` | contains filename, per-table `N -> M`, "rolled back", the literal `ALLOW_DESTRUCTIVE_MIGRATIONS=<file>`, and the "do not set this if unexpected" sentence |

---

## 7. What happens to the in-file 012 guard: **remove it**

Revert `migrations/012_performance_block.sql` to `main`'s unconditional `DELETE FROM analyses;`.

1. **It defends the wrong statement.** Proven in review round 2: the surviving row is copied forward
   with 17 `NULL` columns. It saves an ID and a URL and destroys the analysis.
2. **It cannot fix the schema regression at all.** Re-running 012 reverts 013's widened
   `perf_unavailable_reason` CHECK no matter what the `DELETE` says. The guard's own stated goal is
   unreachable from inside 012.
3. **Keeping it actively breaks the new runner check.** With the guard, a forced 012 re-run moves
   `analyses` 1 → 1 and Check C stays silent while the perf block is destroyed. Without it, 1 → 0 and
   Check C fires. Defence-in-depth here is not neutral — it is a blindfold.
4. **False confidence is the specific failure mode this whole series keeps hitting.** Three rounds of
   "the guard now handles it" each turned out to be wrong. A guard that half-works, in a file that says
   in a 30-line comment that it fully works, is worse than no guard next to an honest runner-level abort.

### 7.1 Checksum interaction (#278's adopt-on-first-sight policy)

Verified, not assumed: `git diff main f84f150 -- migrations/012_performance_block.sql` shows the guard is
the **only** change to that file. Reverting it makes 012 byte-identical to what every environment
actually applied.

Consequence: **the PR then edits zero `.sql` files.** The adopt-on-first-sight policy has nothing to
reason about — every legacy row adopts the checksum of the exact bytes that were applied. This also
removes the PR's most delicate argument (that a content edit is safe because it rides the same deploy
as checksum adoption) instead of having to keep defending it. It is strictly consistent with the PR's
own stated principle that `migrate.ts` never touches on-disk migration content.

---

## 8. Ticket breakdown

Single BE ticket. The three checks share one function, one test file, and one RUNBOOK section; splitting
them would mean three developers editing the same 100 lines of `runMigrations`. See the GitHub issue for
the developer-facing form.

Dependency: **PR #305 must merge first.** Check B is built on the `checksum` column #278 introduces, and
Check C is built on the interactive transaction #277 introduces. Neither exists on `main` today.
