# Defect C — thin reel payload misclassified as image post (#254)

Created 2026-08-18. Ticket: https://github.com/jordanjordann/my-content/issues/254
Labels: `bug`, `blocked`. Size M, backend. **Not** `ready-for-agent` — open owner ruling.

## The one-line fact

`hasReachFields()` (`lib/server/analysis/performance/reach.ts:33`) is a key-presence test used as a
content-kind inference. An image post lacks the reach keys; a **thin reel payload also lacks them**.
Both resolve `derivedFrom: "NONE"` → `computeBlock.ts` `resolveTier1Ratio()` gives the reel a
**follower-denominated** ratio, which the R-12.2.1 comment at `computeBlock.ts:57-64` forbids.

Live instance: row `581a798a` (giorrando reel) — `NONE` / `FOLLOWERS` / `REACH_ONLY` / score 4 /
ratio `(3132+75)/255774`. Not comparable with the other reels. FROZEN per TDD §14.8a / D8.

## Things I confirmed that are worth not re-deriving

- **Parsing is not lossy.** `client.ts:91` is a bare `(await response.json()) as T`. No zod, no strip.
- On a **non-carousel**, `NONE` is reachable ONLY via the missing-key branch. A key present with
  `null` gives `TOP_LEVEL` + `UNKNOWN`. So key-absence is proven, not inferred.
- **`REACH_UNKNOWN` needs no new logic.** `judgement.ts` item 4 (line ~431) already maps
  "`derivedFrom !== NONE` + reach unusable" → `REACH_UNKNOWN`. Fixing `reach.ts` alone makes the whole
  `UNAVAILABLE` path fire. Do NOT edit `computeBlock.ts` or `judgement.ts` for this.
- `perf_unavailable_reason` is NULL on **all 8** rows. `REACH_UNKNOWN` has never been written. #254
  will be the first write — that render path is unexercised against real data.
- `ReachResult.hasVideo` already exists (B1, PR #191) and is consumed by `prompts/user.ts` `isImageOnly`.
  A thin reel is currently announced to Gemini as image-only content. Same root cause, second symptom.
- **`resolveYoutubeReach()` in the same file already returns `TOP_LEVEL` + `UNKNOWN` for a null value.**
  That is the precedent for the proposed Instagram shape — it is not a new state.

## The blocker (why not ready-for-agent)

R-12.7.1. `reach.ts:7-20`, TDD §433 and TDD §485 all forbid branching on `__typename` / `is_video` in
reach resolution. PR #152 BLOCKING 1 was exactly this. But R-12.7.1's authoritative source, PRD §739,
is **directional** — it forbids `__typename` *suppressing a present reach field*. The fix only
consults the video signal **inside the already-`NONE` branch**, to downgrade "no reach field" to
"reach unknown". It can never hide a present field. Owner must rule on whether that is in scope.

If ruled permitted, a follow-up must amend `reach.ts`'s module doc + TDD §433/§485. Not in #254 —
PR #253 is open on the TDD.

## Table state (read-only snapshot, 2026-08-18)

8 analyses: 6 `reel|TOP_LEVEL` (5 giorrando + 1 anaball.id), 1 `reel|NONE` (`581a798a`, the defect),
1 `carousel|NONE` (`b04d7d23`, giorrando). Frequency 1-in-8 — **too small to state a rate.**

All 3 reel fixtures are 59-key `XDTGraphVideo`. Nothing resembles the thin shape; #254 adds a
clearly-marked SYNTHETIC fixture.

## Standing constraints re-confirmed this session

- OR-25 NO RETRY (settled 2026-08-06, re-litigated twice).
- Stored `perf_*` FROZEN — no backfill without explicit owner ruling.
- Never spend SC/Gemini credits. Balance 31,986 (2026-08-07 upper bound). A live re-fetch of the
  `581a798a` URL is the ONLY way to settle transient-vs-permanent and it is an **owner** action.
- `my-content.db` read-only. No Railway/Turso mutation.
