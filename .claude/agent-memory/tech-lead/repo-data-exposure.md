# Repo data exposure, fixtures, and anonymisation (#264)

Staged 2026-08-19 during the prod data-scrub ticket. **The repo stays PUBLIC** (owner ruling), so
everything below is a live concern, not a theoretical one.

## Repo facts worth remembering

- **`my-content.db` is TRACKED by git** even though `.gitignore` line 42 lists it — ignore rules do not
  untrack an already-added file. It holds one full production `analyses` row (Gemini output, real caption,
  live IG post URL, CDN URLs). **Densest real-data exposure in the repo, and invisible to text grep.**
  Fix is `git rm --cached my-content.db`; dev falls back to `file:./my-content.db` when
  `TURSO_DATABASE_URL` is unset, so local dev is unaffected.
- **`.claude/context/fixtures/scrapecreators-instagram/*.json` are UNEDITED captured API responses** —
  ~130 distinct real IG usernames, numeric user IDs, real captions, signed CDN URLs; ~940 KB across 21
  files. Any "anonymise the repo" task must include these. They are easy to miss because they are
  single-line JSON that blows up grep output.
- **Only ONE creator handle exists in the repo.** A frequently-repeated brief claim about a second handle
  (`anaball…`) is **false** — zero hits tree-wide.
- `tests/server/env/productionEnv.test.ts` contains a string literal beginning `SECRET-CANARY-…`. It is a
  **deliberate fake** proving the boot guard never echoes a URL. **Do not flag it as a leak.**
- **Real production UUIDs live in exactly one test file:**
  `tests/server/analysis/performance/readModel.test.ts` (8 distinct, arrived via PR #263). `main` before
  #263 had almost none.

## Technique worth reusing

- **When a brief supplies an inventory, re-derive it with `git grep -c` per pattern** rather than trusting
  the list. In this session **7 of the brief's premises were wrong; every single one was a *derived count
  or conclusion*, while raw file paths checked out.** Same pattern as prior sessions —
  **raw facts verify, derived figures do not.**
- **Grep for the *values* independently of the *files*.** The brief attributed reach values to
  `baseline.test.ts`; grepping the values showed they were in `readModel.test.ts` and the fixtures instead.

## Domain gotcha — anonymising numeric fixtures

Test fixtures here encode **relationships**, not just values. When renaming/renumbering:
- self-exclusion tests need the row's own id **byte-identical** to its pool entry;
- the **D8 freeze test needs TWO relationships preserved at once** — `stored_reach / stored_median` must
  reproduce the stored multiplier exactly in IEEE-754, **AND** `stored_reach / live_median` must be far
  enough away that the `not.toBeCloseTo` guard would fire.
- **The failure mode to guard for in review:** someone weakens an assertion (`toBe` → `toBeCloseTo`,
  deleting a `not.toBe`) to accommodate new fixtures. Suite goes green, proves nothing.

## Repo label set (do not invent labels)

`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`,
`question`, `wontfix`, `ready-for-agent`, `blocked`.

**There is NO `chore` and NO `tech-debt` label.** Briefs have asked for "a low-priority chore/tech-debt
label that already exists" — it does not. Closest existing pair: `good first issue` + `documentation`
(used on #270). Never create one.

## SETTLED (2026-08-20, #270) — the "live network call" test is a FALSE POSITIVE

`tests/server/analysis/media/prepareParts.mimeType.test.ts` was flagged by a reviewer as making a real
unmocked fetch to a signed Instagram CDN URL. **It does not.** Verified statically:

- `:4-10` — `vi.mock("@/lib/server/analysis/downloader")` stubs `downloadMedia` **and** `downloadVideo`.
- `prepareParts.ts:102` — the image branch's ONLY outbound call is `downloadMedia(...)`. That's the mock.
- `:32` `JPEG_MAGIC_BYTES` — the committed byte-prefix fixture already exists. Nothing to migrate.
- `:30` `REAL_DISPLAY_URL` is a **string input only**. Path: `prepareParts.ts:110`
  `getImageMimeType(buffer, part.url)` → `upload.ts:133` `path.extname(new URL(url).pathname)`. Pure
  parsing. **Expiry of `oh=`/`oe=` cannot break it — not a time bomb.** (The URL has no `_nc_sig=` param,
  contrary to how it gets relayed.)
- The assertion resolves at `upload.ts:102-104` from the **buffer's** magic bytes, before the URL is read.

**Why reviewers keep flagging it:** the file says "REAL/unmocked `getImageMimeType()`" (`:12-18`) and
"live display_url" (`:34`, `:39`). "Unmocked" means *the function isn't stubbed*, not *the URL is
fetched*. #270 is a **rename-only** ticket to kill that ambiguity. The URL must stay **verbatim** — it is
the ticket-#71 B1 regression guard (`upload.ts:83-100`, a real production outage where
`split(".").pop()` on the query string yielded `application/octet-stream` and Gemini rejected every
carousel image). Do not sanitise or shorten it; do not delete the test.

If asked again: answer "no network, not gated, runs every `npm test`, still green — because it never
leaves the process."
