# Verify production claims against the production database, not the local file

**Learned 2026-08-19, from ticket #254.**

## What went wrong

I wrote #254's root-cause section — including a frequency figure ("1 in 8 analyses") and a "full table
state (8 rows)" table — from `my-content.db` in the repo root. That file is **not production**.
Production is **Turso `lasa`** (`aws-ap-northeast-1`), read via `~/.turso/turso db shell lasa "SELECT ..."`.

Turso had **10** rows; the local file had **8**; the union is **11**. Three stripped rows existed in
production that I never saw, and one existed locally that production never saw. The two databases had
already diverged because **localhost still writes to `my-content.db`** while the deployed app writes to
Turso.

The wrong dataset did not just make a number wrong. It made me characterise a **sustained 6-minute
upstream degradation window affecting 3 different posts across 2 environments** as a **single
anomalous request**. The fix survived; the diagnosis did not.

## Rules

1. **Before quoting any row count, frequency, or "N in M" figure about production, query production.**
   `~/.turso/turso db list` first, then `SELECT`. Never infer production state from a local SQLite file
   in the repo.
2. **When two stores can both be written, state which one you read** in the ticket, by name, and say
   whether you checked the other. "Verified read-only against `my-content.db`" is not a production claim.
3. **Never write a rate from a single-digit sample.** Even the corrected sample (4 of 10) is too small.
   Report the raw counts and the time distribution instead — the *clustering* (all 4 in one 6-minute
   window, all 6 clean the day before) carried the entire diagnosis, and a rate would have hidden it.
4. **`SELECT` only against production.** No `INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`, no `db create`,
   no `db destroy`, no token creation.

## The diagnostic move that actually worked

Ordering every row by `created_at` and putting the **clean** and **failed** fetches in one table.
Field-level comparison alone said "fields are missing". The time ordering said "everything on day A
worked and everything on day B failed" — which is what falsified the per-post hypothesis.

Second most useful: finding **the same URL fetched twice, minutes apart, with different stored values**
(`has_audio` `true` then `false`). Non-determinism falsifies any "this post is in a stable state"
theory in one line. Always look for a repeated URL before theorising about a post being special.

## Corollary — check which fields SURVIVED, not just which vanished

The survivors were the load-bearing evidence. `analysis_mode = 'full_video'` on all four stripped rows
proved `isVideoNode()`'s `__typename`/`is_video` signal survives the strip — which is exactly the
signal the proposed fix depends on. I had assumed that; the survivors turned it into an observation.
