# Test fixtures

## Where the real captures live

`.claude/context/fixtures/` — **not** here. Tests load them through
`tests/helpers/fixtures.ts`. There is deliberately one copy: `docs/RUNBOOK.md` §6 and
`docs/HANDOFF-2026-07-22.md` already point every agent at `.claude/context/fixtures/`, and a second
copy under `tests/` would be a second thing to drift.

| Fixture set | Endpoint | Count |
|---|---|---|
| `scrapecreators-youtube/` | `/v1/youtube/video`, `/v1/youtube/channel` | 10 real captures (2026-07-21) |

## The suite is offline by construction

No test may call a live API. ScrapeCreators is credit-based (~25k credits) and
`/v1/youtube/channel` **charges a credit even for a not-found handle**. Transport-level tests stub
`fetch` and feed it committed payloads (`tests/server/scrapecreators/client.test.ts`).

## `synthetic/` is not a capture directory

`tests/fixtures/synthetic/` holds hand-built minimal inputs typed as `ScrapeCreatorsMedia`. They
exist to drive `adapter.ts`'s own branches. They are **not evidence of what the API returns** and
must never be cited as such, nor promoted into `.claude/context/verified-facts.md`.

## Outstanding: `/v1/instagram/post` captures

Ticket #64 asked for three real Instagram captures — a reel, an all-image carousel, and a
**video-bearing carousel**. **None are committed, and none were captured**, because capturing them
requires live credit-charged calls, which this ticket's brief prohibits outright.

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
