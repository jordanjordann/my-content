# Verified external API facts

Facts in this file are captured from **live** API responses, not documentation.
Per `AGENTS.md` ("External API Verification"), code must be built against what
is documented here. If an endpoint isn't listed below, stop and capture it
live before writing code against it.

---

## ScrapeCreators — `/v1/youtube/video`

- **Tested:** 2026-07-21
- **Tested URL:** `https://www.youtube.com/shorts/tPEE9ZwTmy0` ("Shortest Video
  on Youtube", channel `@hiddentracktv2`)
- **Raw captures:** `/tmp/yt_short.json` (original capture, pre-topup),
  `/tmp/yt_video_fresh.json` (re-verification, 2026-07-21), `/tmp/yt_video_trim.json`
  (`trim=true` variant)

### Request

- `GET /v1/youtube/video?url=<full youtube URL>`
- Query param is `url`, accepting a standard `youtube.com/shorts/<id>` (or
  presumably `youtube.com/watch?v=<id>`) URL — not just a bare video id.

### Envelope

**Flat response — there is no `data` wrapper.** Unlike
`/v1/instagram/post` (`data.xdt_shortcode_media`) and `/v1/instagram/profile`
(`data.user`), all fields are top-level. Do not add an envelope unwrap step
by analogy with the Instagram client.

### Confirmed top-level keys (from live capture)

```
success: boolean
credits_remaining: number
type: "video"
id: string                          // e.g. "tPEE9ZwTmy0"
title: string
description: string
descriptionLinks: string[]
commentCountText: string            // e.g. "67K"
commentCountInt: number             // e.g. 67000
likeCountText: string               // e.g. "1243114"
likeCountInt: number
viewCountText: string               // e.g. "58,622,648" (comma-formatted)
viewCountInt: number
publishDateText: string             // e.g. "Jan 19, 2011" (human-readable)
publishDate: string                 // ISO-8601 WITH OFFSET, e.g.
                                     // "2011-01-19T09:40:47-08:00" —
                                     // NOT a unix-seconds timestamp like
                                     // Instagram's taken_at_timestamp.
collaborators: unknown[]
channel: {
  id: string        // "UC..." channel id, e.g. "UC9kN-ROrTY81zH856AxXuGQ"
  url: string        // "https://www.youtube.com/@hiddentracktv2" (has leading @)
  handle: string      // "hiddentracktv2" (NO leading @)
  title: string
}
chapters: unknown[]
watchNextVideos: unknown[]          // unrelated recommended-videos data,
                                     // bulk of the payload; do not persist
thumbnail: string                   // "https://img.youtube.com/vi/<id>/maxresdefault.jpg"
keywords: string[]
genre: string
durationMs: number                  // MILLISECONDS, e.g. 1000 for a 1s video
durationFormatted: string           // "00:00:01"
captionTracks: array of {
  baseUrl, name: { simpleText }, vssId, languageCode, kind, isTranslatable, trackName
}
downloadOptions: {
  expiresInSeconds: string
  hlsManifestUrl: string | null
  dashManifestUrl: string | null
  formats: unknown[]                // came back EMPTY in the live capture
  note: string                      // API's own note that formats can be
                                     // signature-ciphered / absent
}
isPaidPromotion: boolean
```

Note: `downloadOptions` looked like it could replace `yt-dlp`, but formats
came back empty with null manifest URLs. **Confirmed not usable for download
— `extractVideoUrl` (yt-dlp) still owns download URL extraction.**

### `trim` parameter

Tested `trim=true` vs no `trim` param (2026-07-21,
`/tmp/yt_video_trim.json` vs `/tmp/yt_video_fresh.json`):

- **No effect.** Same top-level key set in both responses. No envelope was
  stripped (there was none to strip) and no fields were dropped —
  `captionTracks`, `downloadOptions`, etc. all present identically in both.
  This is unlike `/v1/instagram/post`, where `trim=true` silently strips the
  `data` envelope and drops `dimensions`/`display_resources` (see PR #42).
- **Decision: do not pass `trim` at all** for the YouTube video endpoint —
  it has no observed effect, so omitting it keeps the request minimal.

### Error behaviour

Tested against a bogus/deleted video id
(`https://www.youtube.com/shorts/aaaaaaaaaaa`, capture:
`/tmp/yt_video_deleted.json`):

- Real **HTTP 404**, body `{"success": false, "credits_remaining": <unchanged>, "error": "not_found", "errorStatus": 404, "message": "Video unavailable"}`.
- This is a genuine non-2xx HTTP status, so it's already handled by the
  existing `scRequest`/`mapStatusToMessage` non-ok path — no YouTube-specific
  "success: false but HTTP 200" handling is needed for this endpoint (unlike
  what the ticket flagged as a risk; verified it does NOT happen here).
- **No credit charged** for a not-found video.

### Credit cost

- 1 credit per successful `/v1/youtube/video` call.
- 0 credits charged for a 404 (deleted/invalid video id).

---

## ScrapeCreators — `/v1/youtube/channel`

- **Tested:** 2026-07-21
- **Tested handle:** `hiddentracktv2` (channel from the video capture above,
  channel id `UC9kN-ROrTY81zH856AxXuGQ`)
- **Raw captures:** `/tmp/yt_channel_handle.json` (bare handle, no `@`),
  `/tmp/yt_channel_athandle.json` (`@`-prefixed handle),
  `/tmp/yt_channel_ucid.json` / `/tmp/yt_channel_ucid2.json` (`UC...` id
  passed as `handle` — fails, see below), `/tmp/yt_channel_trim.json`
  (`trim=true` variant), `/tmp/yt_channel_bogus.json` (nonexistent handle)

### Request

- `GET /v1/youtube/channel?handle=<handle>`
- Query param is **`handle`**, not a channel-id param. Confirmed by testing:
  - `handle=hiddentracktv2` (no `@`) → **works**, returns the channel.
  - `handle=@hiddentracktv2` (with `@`) → **also works**, identical result.
  - `handle=UC9kN-ROrTY81zH856AxXuGQ` (the `UC...` channel id) → **does NOT
    resolve** — see Error behaviour below.
- **Client must use `channel.handle` from the video payload (or a bare
  `@handle`-style string), never `channel.id`.**

### Envelope

**Flat — no `data` wrapper**, same as `/v1/youtube/video`.

### Confirmed top-level keys (from live capture)

```
success: boolean
credits_remaining: number
channelId: string                   // "UC..." — present here even though
                                     // the request param is `handle`
channel: string                     // channel URL, e.g. "http://www.youtube.com/@hiddentracktv2"
handle: string                      // echoes the handle, e.g. "@hiddentracktv2"
isVerified: boolean
name: string
description: string
subscriberCount: number             // *** CONFIRMED: numeric subscriber
                                     // count exists. Field name is
                                     // `subscriberCount`. e.g. 268000 ***
subscriberCountText: string         // e.g. "268K subscribers"
videoCountText: string
videoCount: number
viewCountText: string
viewCount: number
joinedDateText: string
tags: string                        // comma-separated string (not array)
email: string | undefined
country: string | undefined
instagram, facebook, twitter, discord, reddit, ... : string | undefined  // arbitrary social-link fields, vary per channel
links: string[]
keywords: string[]
isFamilySafe: boolean
facebookProfileId: string | null
avatar: string
banner: string
```

**Ticket #57 (engagement rate) can proceed: `subscriberCount` (number) is
confirmed present and correctly typed.**

### `trim` parameter

Tested `trim=true` (2026-07-21, `/tmp/yt_channel_trim.json`): identical key
set to the untrimmed response. **No effect, same decision as the video
endpoint — do not pass `trim`.**

### Error behaviour

Tested two not-found cases:

1. Passing the `UC...` channel id as `handle` (`/tmp/yt_channel_ucid.json`,
   `/tmp/yt_channel_ucid2.json`):
2. A wholly nonexistent handle (`/tmp/yt_channel_bogus.json`):

Both returned real **HTTP 404** (confirmed via `curl -w "%{http_code}"`), with
body:

```json
{
  "success": true,
  "credits_remaining": <n>,
  "channel": "https://www.youtube.com/<handle>/about",
  "userId": null,
  "message": "Account doesn't exist",
  "accountDoesNotExist": true,
  "error": "not_found",
  "errorStatus": 404
}
```

Note the body says `"success": true` despite being a failure — **but the
actual HTTP status is 404**, so `scRequest`'s existing non-ok-status path
already throws a `ScrapeCreatorsError` before the body's `success` field is
ever inspected. No extra "success:true but actually failed" detection logic
is needed for this endpoint given current `scRequest` behaviour (it checks
`response.ok`, not the JSON body, to decide success/failure).

### Credit cost

- 1 credit per `/v1/youtube/channel` call.
- **Unlike the video endpoint, a not-found channel still costs 1 credit**
  (observed 25007→25006 and 25003→25002 across the two not-found tests
  above). Asymmetric with `/v1/youtube/video`, which charges 0 for a 404.

---

## Credit ledger for this verification session (2026-07-21)

| Call | credits_remaining after |
|---|---|
| `getYoutubeVideo` (fresh, no trim) | 25009 |
| `getYoutubeChannel` (handle, no `@`) | 25008 |
| `getYoutubeChannel` (handle, with `@`) | 25007 |
| `getYoutubeChannel` (handle=UC id — not found) | 25006 |
| `getYoutubeVideo` (trim=true) | 25005 |
| `getYoutubeChannel` (trim=true) | 25004 |
| `getYoutubeVideo` (deleted video, 404) | 25004 (unchanged — 0 cost) |
| `getYoutubeChannel` (handle=UC id — not found, repeat) | 25003 |
| `getYoutubeChannel` (bogus handle — not found) | 25002 |

Net spend for this ticket's verification: 7 credits (video: 2 successful
calls = 2 credits + 1 not-found = 0; channel: 5 calls, all charged, = 5
credits).
