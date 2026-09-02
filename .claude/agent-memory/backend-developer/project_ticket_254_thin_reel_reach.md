# Ticket #254 — thin reel payload reach misclassification (done, PR #259)

Implemented on branch `fix/254-thin-reel-reach-classification`, PR #259, branched off `main` at
`e5319a4` (post-#258). Not merged — owner merges personally.

## What shipped

- `lib/server/analysis/performance/reach.ts` — non-carousel `NONE` branch now checks
  `isVideoNode(raw)` before falling back to `noneResult()`. OR-27 (owner ruling, PR #255) permits
  this: a positive video signal used ONLY inside the branch that has already resolved "no reach
  keys present" to reinterpret an absence, never to suppress a present field. Thin video reels now
  resolve `derivedFrom: "TOP_LEVEL"`, `state: "UNKNOWN"`, `hasVideo: true` instead of
  `derivedFrom: "NONE"`, `hasVideo: false`.
- `lib/server/analysis/media/resolveMediaParts.ts` — `isVideoNode` exported so `reach.ts` reuses
  the existing C7 discriminator instead of duplicating it.
- `lib/server/scrapecreators/instagram.ts` — `getInstagramPost` now warns (never throws, OR-25 no
  retry) when the envelope's `errors` array is non-empty.
- New synthetic fixture: `.claude/context/fixtures/scrapecreators-instagram/ig_reel_thin_no_reach_fields.json`,
  derived from `ig_reel_2.json` with the 5 keys observed missing in production deleted, identifying
  fields scrubbed, marked `_synthetic_fixture_note` in-file.
- `computeBlock.ts`/`judgement.ts` were **not touched** — traced end-to-end and confirmed the
  `REACH_UNKNOWN`/`UNAVAILABLE` path was already correctly wired, just unreachable before this fix.

## Corrections to the relayed brief (verified against code, not assumed)

- **`ScrapeCreatorsPostEnvelope.errors` already existed** in `lib/server/scrapecreators/types.ts`
  on `main` at `e5319a4` — the brief's "Files affected" list said this needed adding; it didn't.
  Only the consumer-side warn (`instagram.ts`) was new. Worth checking types.ts state fresh on any
  future ticket touching this envelope — it may have drifted further since.
- The relayed "Files affected" list matched everything else accurately (verified reach.ts,
  computeBlock.ts, judgement.ts, resolveMediaParts.ts, prompts/user.ts's `isImageOnly` line 269
  directly against source).

## Test result

894 tests passed (66 files), tsc/lint/build all clean. Baseline on `main` after #258 was ~886; net
+9 tests added by this PR (5 in reach.test.ts, 1 in computeBlock.test.ts, 3 new in
tests/server/scrapecreators/instagram.test.ts).

## Still open / not done here (explicitly out of scope)

- No backfill/recompute of row `581a798a` or any stored `perf_*` value — frozen (TDD §14.8a/D8).
- Manual UI render of an `UNAVAILABLE`/`REACH_UNKNOWN` analysis is still unverified against real
  data — flagged as an owner/QA action in the PR, not agent work.
- Did not re-verify the Turso production row census myself this session (no new `SELECT`s beyond
  what code-reading required) — the fix is fixture-driven, doesn't depend on the exact row count.
  If a future ticket needs a fresh census, re-run against Turso `lasa`, not the local
  `my-content.db` fossil.

STATUS: PR #259 merged as `cfe7ec5`. Applied to canonical agent memory 2026-08-20.
