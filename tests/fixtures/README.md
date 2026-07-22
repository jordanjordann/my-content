# Test fixtures

## Where the real captures live

`.claude/context/fixtures/` — **not** here. Tests load them through
`tests/helpers/fixtures.ts`. There is deliberately one copy: `docs/RUNBOOK.md` §6 and
`docs/HANDOFF-2026-07-22.md` already point every agent at `.claude/context/fixtures/`, and a second
copy under `tests/` would be a second thing to drift.

| Fixture set | Endpoint | Count |
|---|---|---|
| `scrapecreators-youtube/` | `/v1/youtube/video`, `/v1/youtube/channel` | 10 real captures (2026-07-21) |
| `scrapecreators-instagram/` | `/v1/instagram/post` | 6 real captures (2026-07-22, PR #84) — see `docs/RUNBOOK.md` §6 |

**Do not delete files under `.claude/context/fixtures/`.** They are real, credit-charged API
captures — replacing one means spending credits again. See the "do not delete these" note
committed alongside them at `.claude/context/fixtures/README.md`.

## Outstanding: no non-Shorts YouTube video capture

`yt_short.json`, `yt_video_fresh.json`, and `yt_video_trim.json` are all the SAME Shorts video
(id `tPEE9ZwTmy0`) — `yt_short.json` is a separate scrape of it at a different time (it differs
only in fields that naturally drift between captures: view/like counters, `watchNextVideos`
recommendations, `credits_remaining`). There is **no capture anywhere in this repo of a regular,
non-Shorts video**.

An earlier version of `youtubeFixtures.test.ts` had a test named to the effect of "has the same
top-level key set for a Short as for a regular video request" that compared `yt_short.json` against
`yt_video_fresh.json` — since both are the same file, that test was comparing a capture to itself
and presenting the tautology as a finding about Shorts vs. regular videos. It has been replaced with
a test that states the gap plainly (`describe("/v1/youtube/video — KNOWN GAP: no non-Shorts capture
exists")`) rather than asserting something the fixtures cannot support.

To close this gap, capture one regular (non-Shorts) `/v1/youtube/video` response and commit it
under `.claude/context/fixtures/scrapecreators-youtube/` (1 credit, 0 on a 404). Until then, any
claim about Shorts-vs-regular-video shape parity is unverified.

## The suite is offline by construction

No test may call a live API. ScrapeCreators is credit-based (~25k credits) and
`/v1/youtube/channel` **charges a credit even for a not-found handle**. Transport-level tests stub
`fetch` and feed it committed payloads (`tests/server/scrapecreators/client.test.ts`).

## `synthetic/` is not a capture directory

`tests/fixtures/synthetic/` holds hand-built minimal inputs typed as `ScrapeCreatorsMedia`. They
exist to drive `adapter.ts`'s own branches. They are **not evidence of what the API returns** and
must never be cited as such, nor promoted into `.claude/context/verified-facts.md`.

## `/v1/instagram/post` captures — now committed (PR #84)

Ticket #64 asked for three real Instagram captures — a reel, an all-image carousel, and a
**video-bearing carousel**. None of that was committed *by ticket #64* — capturing them required
live credit-charged calls, which #64's brief prohibited outright — but **PR #84 has since captured
and committed six real fixtures**, including a video-bearing carousel, at
`.claude/context/fixtures/scrapecreators-instagram/`. See `docs/RUNBOOK.md` §6 for the full
inventory and `.claude/context/verified-facts.md` for the field-level findings.

The adapter tests below still run on synthetic inputs — converting them to golden files against
the real captures is follow-up work this PR does not do.

What that costs, concretely:

- `tests/server/analysis/fetcher/adapter.test.ts` pins the adapter's *logic* using synthetic inputs.
  It does **not** pin the adapter against a real payload, so a change in Instagram's response shape
  would not be caught by it.
- `ScrapeCreatorsCarouselChildNode`'s video fields (`video_url`, `video_duration`, `has_audio`,
  `clips_music_attribution_info`) remain **modelled, not confirmed** — exactly as
  `lib/server/scrapecreators/types.ts:67` says. Ticket #64's own acceptance criteria call this out:
  if the video-bearing carousel could not be sourced, report it rather than synthesise it.
- **Ticket 8 (carousels, TDD §7) is still blocked on this capture.** `resolveMediaParts()` is
  specified against a child shape nobody has seen.

To close the gap, an owner-approved capture session needs: one reel URL, one all-image carousel URL,
and one carousel URL known to contain at least one video slide — 3 credits total at
`/v1/instagram/post`'s 1 credit per call. Commit the raw bodies to
`.claude/context/fixtures/scrapecreators-instagram/`, add the endpoint section to
`.claude/context/verified-facts.md`, and convert the synthetic adapter tests to golden files against
them.

**PR #84 has merged** and added exactly these real fixtures at
`.claude/context/fixtures/scrapecreators-instagram/` (six files, including a video-bearing
carousel), plus an append to `verified-facts.md`. `adapter.test.ts`'s synthetic inputs
(`tests/fixtures/synthetic/instagramMedia.ts`) have **not** been converted to golden files against
the real captures yet — that conversion is follow-up work, not done in this PR. The synthetic
tests stay in place for adapter-branch coverage; the carousel-child-shape tests called out below
have had their caveat updated from "unverified" to "falsified", since #84's capture disproved the
shape they assume rather than merely leaving it unconfirmed.

### Carousel video-child shape — falsified by the real capture (PR #84)

`tests/server/analysis/fetcher/adapter.test.ts` has a `describe` block named
`"FALSIFIED — carousel video-child shape disproven by the real capture (PR #84)"`. The three tests
inside it read like assertions about Instagram's real API (they exercise
`resolveVideoUrl`/`resolveAudio` carousel branches), but they run entirely against the synthetic
`makeVideoChild()` fixture, which models `video_duration`, `clips_music_attribution_info`, and
`thumbnail_src` on a video child. PR #84's real capture
(`ig_carousel_mixed_video_and_image_10_slides.json`, 7 real video children) proves those three
fields are **absent on all 7** (see `.claude/context/verified-facts.md`, "Video carousel child —
CONFIRMED shape"). The tests are **kept deliberately** — not deleted — so they fail loudly when
#71 rewrites the adapter against the real (thinner) shape; that failure is the intended outcome,
not a regression to silence.

## Fixture loader fail-fast behaviour

`tests/helpers/fixtures.ts`'s `loadJsonFixture()` throws immediately, naming the missing file and
its resolved absolute path, when a fixture file does not exist — rather than letting a bare
`ENOENT` from `readFileSync` surface with no context about which committed capture is missing or
why.
