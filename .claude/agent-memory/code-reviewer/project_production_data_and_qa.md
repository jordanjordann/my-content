---
name: project-production-data-and-qa
description: Production Turso `lasa` is the only source of truth (my-content.db is a fossil), how to re-census a ticket's row claims, and the credit-free route to QA an un-producible state
metadata:
  type: project
---

Merged from the former `project_stale_local_db_census` (plus its outstanding 2026-08-19 census append) and
the staged `project_credit_free_qa_route`.

## 1. The repo's `my-content.db` is a stale fossil — never cite it

Issue bodies here cite affected-row counts and row IDs taken from the checked-in local `my-content.db`.
**That file is a stale fossil and has produced wrong diagnoses more than once.** Production is **Turso
`lasa`** (`aws-ap-northeast-1`) and is the only source of truth. The two stores diverged because localhost
still writes to `my-content.db` while the deployed app writes to Turso.

On #251 the ticket named row `581a798a` ("Pengalamanku") and an acceptance criterion of "0 rows matching
`perf_multiplier IS NOT NULL`". Production had neither: `581a798a` does not exist, and the real affected
set was `9470151e` + `391b7615` (both `median=7698`, `sampleSize=5`, `multiplier=NULL`,
`perf_reach_value IS NULL` — the actual NOT_COMPARABLE mechanism).

## 2. Re-census before accepting any "N affected rows" claim

`~/.turso/turso db shell lasa "SELECT ..."` — the binary is **not** on `PATH`; read-only, `SELECT` only.
No `INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`, no `db create`, no `db destroy`, no token creation. The
owner's local `.env` points at production and **there is no sandbox**.

- **Always include `profile_id`** — baseline pools are per `(profile_id, perf_bucket_key)`, and a row in
  the same bucket but a different profile inflates a naive count.
- **Never derive a pool size by eyeballing the row list.** The eligibility predicate is
  `(profile_id, perf_bucket_key, schema_version)` + `status='completed'` + `MATURITY_FLOOR_HOURS` (72h) +
  `metricFor()` resolving (a REACH bucket needs a non-null `perf_reach_value`). Run it as SQL.
- **`perf_baseline_sample_size` is NOT what renders.** `readModel.ts` `buildTier2()` substitutes a live
  comparator count for cold-start rows (#206). Deriving a blast radius from the stored column is wrong.
- **Take the census twice on a long review.** During #258's review, production row `7cc2b011` (the only
  `MEASURED` row) vanished between two reads minutes apart, with no write from the reviewer.
  **Deleting analyses to "fix" a display bug is lossy and unapproved** — treat a shrinking row count as a
  reportable incident. (The owner does delete rows himself, so a row named in a ticket body may simply be
  gone — report the discrepancy, don't assume corruption.)
- **Never write a rate from a single-digit sample.** Report raw counts and the time distribution instead.
- Report every discrepancy explicitly in the review comment.

**Census snapshot, 2026-08-19 (PR #259 review) — treat as historical, re-derive before use:** production
`lasa` held **10** rows. Two carried a multiplier (`3b495116` 8.220 / reach 63281, `7b6948fe` 0.239 / reach
8486, both `CREATOR_BASELINE`). `391b7615` was the **only surviving** row exhibiting #254
(`derivedFrom = NONE`, `tier1_denominator = FOLLOWERS`, reel). `9470151e`, `a439b95b`, `581a798a` and
`7cc2b011` no longer exist. `perf_unavailable_reason` was NULL on all 10; **`REACH_UNKNOWN` has never been
written**, so that render path is unexercised against real data.

## 3. Diagnostic moves that actually work

- **Order every row by `created_at` and put clean and failed fetches in one table.** Field-level comparison
  alone says "fields are missing"; the time ordering says "everything on day A worked and everything on day
  B failed", which is what falsifies a per-post hypothesis. This turned a mischaracterised "single
  anomalous request" into a **sustained 6-minute upstream degradation window affecting 3 posts across 2
  environments**.
- **Look for the same URL fetched twice, minutes apart, with different stored values** (`has_audio` `true`
  then `false`). Non-determinism falsifies any "this post is in a stable state" theory in one line.
- **Check which fields SURVIVED, not just which vanished.** The survivors are load-bearing evidence:
  `analysis_mode = 'full_video'` on all four stripped rows proved `isVideoNode()`'s `__typename`/`is_video`
  signal survives the strip — which is exactly the signal the proposed fix depended on.
- **When two stores can both be written, state which one you read**, by name, and say whether you checked
  the other. "Verified read-only against `my-content.db`" is not a production claim.

## 4. Credit-free route to QA a state the pipeline has never produced

To QA an analysis state the pipeline has never produced (e.g. `UNAVAILABLE` / `REACH_UNKNOWN`, first made
reachable by #254): point `.env.local` at a throwaway local SQLite file —
`TURSO_DATABASE_URL="file:./qa-local.db"` — run `npm run db:migrate`, hand-write one `analyses` row with
the target `perf_*` columns, then `npm run dev`. Verify with `SELECT count(*) FROM analyses` (expect 1, not
the production row count) before touching anything. **Revert `.env.local` afterwards.**

**Why:** there is **no fixture-injection seam** in the pipeline — `scRequest` always performs a live
`fetch`, and no `MOCK`/`FIXTURE`/`DRY_RUN` env flag exists anywhere in `lib/server/scrapecreators/` or
`lib/server/analysis/fetcher/`; driving a committed fixture end-to-end would also reach Gemini. So a real
run always costs credits. **Hand-writing into production Turso was proposed and rejected**: `analyses` rows
are inputs to one another, rows are permanent and visible in the list UI, and deleting them is lossy and
unapproved. A separate throwaway Turso DB is unnecessary — creating infra is forbidden and the local file
is equivalent.

Two facts that make the local route safe (verified 2026-08-19): `lib/server/db.ts` takes a `file:` URL
directly (its fallback is `file:./my-content.db`), and the production boot guard returns early unless
`NODE_ENV === "production"` (`productionEnv.ts:18`), so it does not fire under `npm run dev`. **Note the
owner's default `.env` points at production and `npm run dev` writes production — the `.env.local`
override is the only thing standing between a QA session and a real write.**

One nuance: a `REACH_UNKNOWN` row carries `perf_reach_value = NULL` and therefore does *not* enter the
comparator pool (production row `391b7615` demonstrated this), so the "shifts the median" objection does
not apply to that shape — but the permanence/visibility objection still does.

Building a real `SC_FIXTURE=<name>` seam in `scRequest` is ~30-60 lines plus its own production guard —
only worth it after a second payload-shape bug.

## 5. Credits — do not measure, and note the conflicting figures

**Never spend ScrapeCreators or Gemini credits.** `credits_remaining` exists nowhere in the DB schema; it
can only be read off a live API response. If you need it, read it off a call you were **already going to
make**. The repo currently carries **four disagreeing figures** — see the conflict note in
[[owner-preferences]]. Do not resolve it by measuring.

**Correction from the 2026-08-21 live audit:** `POST /api/analyze` returns `{analysisIds,
analysesCreated, failedUrls}` — there is **no `credits_remaining` field anywhere** in this app's
responses. Credits are external (ScrapeCreators + Gemini) and never surfaced. When a budget IS approved,
track spend by **counting completed `analyses` rows** (each success = 1 fetch + 1 Gemini). A new-analysis
FAILURE **DELETEs its row** (`pipeline/index.ts:397`) — so failed attempts leave no trace; count them
from the batch-result panel / `failedUrls`, not the DB.

## Running a LIVE e2e audit (when a budget is explicitly approved)

- **Browser:** the global `npx @playwright/cli@0.1.18` is a full CLI driver (open/goto/click/screenshot/
  console/requests/`run-code`). It drives the cached `chromium-1228` fine — set
  `PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"`; no repo Playwright install needed.
  The accessible-name selector syntax (`textbox "…"`) throws; use `run-code` with `page.getByRole/
  getByPlaceholder` instead. Screenshots: `screenshot --filename /tmp/…png --full-page` (space, not `=`).
- **Auth:** dev PIN is `1234` (`docs/RUNBOOK.md`). The auto-mode classifier BLOCKS bcrypt-compare and
  auth-`curl` as "brute force" — log in through the browser UI instead. The PIN field is a segmented
  input; `getByRole('textbox').fill()` may not register — use `keyboard.type('1234')`.
- **Go/no-go gate before spending:** confirm live `<thead>` has 0 `button[aria-label*=Sort]` / 0
  `[aria-sort]` (proves `f929fb4`+). Instrument-validate before filing (see [[verify-the-brief]] form 10)
  — my first-pass selector hit the Prompt `<textarea>` not the URLs `<input>`, nearly mis-filing the
  UrlChipInput evidence.
- **Watch out:** IG `/reel/AAAAAAAAAA1`-style "fake" shortcodes are NOT fake — short base64 decodes to
  real early-2010 posts (@kevin/Systrom). They cost a credit and resolve. Use malformed non-URL strings
  for free error paths (they fail at chip validation before the API).

Related: [[verify-the-brief]], [[review-conduct]], [[project-performance-read-model]],
[[project-boot-guard]].
