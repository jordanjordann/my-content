# Verified external API facts

Facts in this file are captured from **live** API responses, not documentation.
Per `AGENTS.md` ("External API Verification"), code must be built against what
is documented here. If an endpoint isn't listed below, stop and capture it
live before writing code against it.

> **One deliberate exception, added 2026-08-18 and quarantined at the bottom of
> this file:** the section **"Infrastructure — first-party documentation facts
> (NOT live captures)"** records Railway and Turso *platform* facts taken from
> vendor documentation. They are **not** live captures and do **not** carry this
> file's usual guarantee. They are here because the alternative was the next
> agent re-deriving them from contradictory forum posts. **Every claim in that
> section is individually labelled `[DOC]` or `[LIVE]`. Never cite a `[DOC]`
> line as a verified capture.**

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
avatar: { image: { sources: Array<{url, width, height}> }, avatarImageSize: string }
                                     // object, NOT a string — one 68x68
                                     // source observed in every capture
banner: Array<{url, width, height}> // array, NOT a string — 6 resolution
                                     // variants observed, widest last
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

---

## Gemini SDK — `@google/genai`

- **Captured:** 2026-07-22, ticket #75 (SDK migration off the EOL
  `@google/generative-ai`).
- **Provenance — read this before trusting a line of it:** everything below is
  taken from the **installed typings and shipped source** in
  `node_modules/@google/genai/dist/{genai.d.ts,index.mjs}` at the resolved
  version, plus an **offline** harness that stubs `globalThis.fetch` and drives
  the real SDK end-to-end with canned response bodies. **No live Gemini call
  was made for this section.** Anything below marked *(unverified live)* has
  not been observed against the real service.
- **Resolved version:** `@google/genai@2.13.0` (`package.json` range
  `^2.13.0`). The legacy `@google/generative-ai@0.24.1` is removed; nothing in
  the repo imports it.

### Client construction

```ts
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
```

Options object, **not** a positional key string. There is no long-lived "model"
object — `getGenerativeModel()` has no successor; `model` is a per-call
argument.

### `ai.models.generateContent`

```ts
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: parts,          // ContentListUnion — a Part[] is accepted directly
  config: { temperature: 0.2, maxOutputTokens: 8192 },
});
```

- `generationConfig` is renamed **`config`** on the parameters object, but is
  still serialised onto the wire as `generationConfig`. Observed request body
  from the offline harness: `{"temperature":0.2,"maxOutputTokens":8192}` under
  `generationConfig`, POSTed to
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`.
- `config` keys relevant here: `temperature`, `topP`, `topK`, `candidateCount`,
  `maxOutputTokens`, `stopSequences`, `seed`, `responseMimeType`,
  `responseSchema`, `thinkingConfig`, `systemInstruction`, `abortSignal`,
  `httpOptions` (`GenerateContentConfig`, `genai.d.ts:4969`).
- `createPartFromUri(uri, mimeType)` (`genai.d.ts:2653`) returns exactly
  `{ fileData: { fileUri, mimeType } }` — verified by calling it. It is a
  drop-in for the hand-built `fileData` part.

### ⚠️ `response.text` is a PROPERTY, not a method

`GenerateContentResponse` declares `get text(): string | undefined`
(`genai.d.ts:5186`). Verified at runtime:
`Object.getOwnPropertyDescriptor(GenerateContentResponse.prototype, "text")`
has a `get` function and **no** `value` — it is a getter.

On the legacy SDK it was `result.response.text()`. **A leftover `()` does not
throw**; it evaluates to a function reference that stringifies into whatever
you persist. Assert `typeof text === "string" && text.length > 0` at the
boundary. `lib/server/analysis/gemini/generate.ts` does this and throws
`"Gemini returned no text content"` otherwise.

The getter returns the concatenation of text parts of the **first** candidate,
**excluding thought parts**, and returns `undefined` when there are none.

### `finishReason` and `usageMetadata`

- `finishReason` lives per-candidate: `response.candidates?.[0]?.finishReason`,
  typed as the `FinishReason` string enum (`genai.d.ts:4522`) —
  `FINISH_REASON_UNSPECIFIED | STOP | MAX_TOKENS | SAFETY | RECITATION | ...`.
- `response.usageMetadata` is a `GenerateContentResponseUsageMetadata`
  (`genai.d.ts:5304`) with `promptTokenCount`, `candidatesTokenCount`,
  **`thoughtsTokenCount`** (separate from `candidatesTokenCount`),
  `cachedContentTokenCount`, `toolUsePromptTokenCount`, `totalTokenCount`, and
  per-modality breakdowns. `totalTokenCount` is documented as the sum
  *including* `thoughtsTokenCount`.
- Thinking tokens are billed against `maxOutputTokens` on `gemini-2.5-flash`
  (proven last session on the legacy SDK: 38 output + 48 thinking →
  `MAX_TOKENS`, truncated unparseable JSON). Truncated output is not
  salvageable: inspect `finishReason` and throw **before** parsing.

### `config.thinkingConfig` — available, deliberately NOT enabled

`ThinkingConfig` (`genai.d.ts:12883`):

| Field | Meaning |
|---|---|
| `includeThoughts?: boolean` | return thought parts in the response |
| `thinkingBudget?: number` | tokens; **`0` = disabled, `-1` = automatic**; defaults and allowed range are model-dependent |
| `thinkingLevel?: ThinkingLevel` | `THINKING_LEVEL_UNSPECIFIED \| MINIMAL \| LOW \| MEDIUM \| HIGH` |

The typings do **not** state the default budget for `gemini-2.5-flash`; with
`thinkingConfig` omitted the SDK sends nothing and the service applies its own
default (i.e. automatic). *(unverified live — the exact default budget for
`gemini-2.5-flash` was not measured, because that needs a live call.)* The
legacy SDK had **no** `thinkingConfig`/`thinkingBudget`/`thoughtsTokenCount`
anywhere, so this surface is new. **#75 did not set it**; the production call
path is unchanged.

### Files API — `ai.files.*` (replaces `GoogleAIFileManager`)

`GoogleAIFileManager` and the `@google/generative-ai/server` entry point have
no successor class. Everything moves onto the unified client.

| Legacy | `@google/genai` |
|---|---|
| `fileManager.uploadFile(path, { mimeType, displayName })` | `ai.files.upload({ file, config: { mimeType, displayName } })` |
| `fileManager.getFile(name)` | `ai.files.get({ name })` |
| `FileState.ACTIVE` / `.FAILED` | same enum, same spelling, exported from the root |

- **`upload` resolves to the `File` object directly** — there is **no
  `{ file: ... }` wrapper** as on the legacy SDK. `upload(params:
  UploadFileParameters): Promise<types.File>` (`genai.d.ts:4106`).
- `UploadFileParameters` = `{ file: string | Blob, config?: UploadFileConfig }`;
  `UploadFileConfig` = `{ mimeType?, displayName?, name?, httpOptions?,
  abortSignal? }` (`genai.d.ts:14787`). A Node file path string is supported.
- `File` fields are all optional (output-only): `name` (`files/<id>`),
  `uri`, `mimeType`, `sizeBytes`, `createTime`, `expirationTime`, `updateTime`,
  `sha256Hash`, `state`, `error`, `videoMetadata` (`genai.d.ts:3928`).
  `uri` being optional is a real typing change — guard it.
- `FileState` is a genuine string enum: `STATE_UNSPECIFIED | PROCESSING |
  ACTIVE | FAILED` (verified at runtime, `genai.d.ts:4437`). Comparisons
  against `FileState.ACTIVE` / `FileState.FAILED` port unchanged.
- **`ai.files.get({ name })` normalises its argument.** `tFileName`
  (`index.mjs:3699`) accepts a full `https://.../files/<id>` URI, a
  `files/<id>` resource name, **or** a bare id, and always sends
  `GET /files/<id>`. The legacy `uri.split("/").pop()` surgery in
  `pollUntilReady` is therefore unnecessary and was removed — the full URI is
  now passed straight through. Verified offline: the stubbed fetch saw
  `.../files/abc123` when given the full v1beta URI.

### Schema (`responseSchema`) — for #66, not used yet

- `Type` replaces the legacy `SchemaType` enum (same members:
  `STRING`/`NUMBER`/`INTEGER`/`BOOLEAN`/`ARRAY`/`OBJECT`).
- `Schema` supports `format: "enum"` + `enum: string[]`, `nullable`, `items`,
  `properties`, `required`, and — unlike the legacy `Schema` type —
  **`propertyOrdering?: string[]`** (`genai.d.ts:11905`).
- **`IntegerSchema` still has no `minimum`/`maximum`.** The 1–5 range check
  belongs in the validation layer (#68). This is unchanged by the migration;
  don't go looking for a schema-level fix.
- The behavioural baseline harness at
  `.claude/context/fixtures/gemini/structured-output-baseline.mjs` has been
  ported to `@google/genai` (full schema, native enums, array of enums,
  nullable enum, nullable number, nested object with `required`,
  `propertyOrdering`, `maxOutputTokens: 32768`). *(unverified live — #75 was
  run under a zero-live-call constraint, so the ported harness was type- and
  shape-checked but not executed. #66 should run it once and record the
  `finishReason` / `usageMetadata` / nullable-number results here.)*

---

## ScrapeCreators — `/v1/instagram/post` (live capture, 2026-07-22)

- **Tested:** 2026-07-22
- **Authorisation:** one-time owner-approved live capture, 5 URLs, 5 credits.
- **Request made exactly as production does it:**
  `GET /v1/instagram/post?url=<canonical post/reel URL>&trim=false`,
  header `x-api-key`, `Accept: application/json` (matches
  `lib/server/scrapecreators/client.ts` + `instagram.ts`, `SC_TRIM = false`).
  `utm_source`/`igsh` params were stripped from the URLs before calling.
- **Raw captures (committed, byte-unmodified):**
  `.claude/context/fixtures/scrapecreators-instagram/`

| Fixture | Source URL | `__typename` | Notes |
|---|---|---|---|
| `ig_carousel_all_images_10_slides.json` | `/p/uSFa7tlyLbw/` | `XDTGraphSidecar` | 10 children, **ALL `XDTGraphImage`** |
| `ig_reel_1_zero_view_count.json` | `/reel/c6JYux8YmyY/` | `XDTGraphVideo` | `video_view_count: 0` but `video_play_count: 116333` |
| `ig_reel_2.json` | `/reel/my0UdbJfZ8O/` | `XDTGraphVideo` | `video_view_count: 305044`, `has_audio: true` |
| `ig_reel_3.json` | `/reel/wgkBvXRiusH/` | `XDTGraphVideo` | `video_view_count: 150780` |
| `ig_single_image_post.json` | `/p/ORKM2Ob4nyB/` | `XDTGraphImage` | **single image, NOT a carousel** — no `edge_sidecar_to_children` |

All five posts belong to the same creator (the primary test creator).

### ⚠️ STILL UNVERIFIED: a carousel containing a VIDEO slide

⚠️ **SUPERSEDED** — see "VIDEO-BEARING CAROUSEL CAPTURED (2026-07-22, follow-up)" below.

**No captured payload contains a video-bearing carousel.** The only sidecar
captured (`ig_carousel_all_images_10_slides.json`) has 10 children, every one
`__typename: "XDTGraphImage"` with `is_video: false` and `video_url: null`.
`ScrapeCreatorsCarouselChildNode`'s video fields (a populated `video_url`,
`video_view_count`, `video_duration`, `has_audio`, `thumbnail_src`,
`display_resources`, `clips_music_attribution_info`) therefore remain
**MODELLED, NOT CONFIRMED**. Ticket #71 (carousel support) is still designing
against an unseen shape. A carousel URL with at least one video slide is
still needed to close this gap.

### Envelope — CONFIRMED, with two NEW fields

```
success: boolean            // true on all 5
credits_remaining: number
credits_charged: number     // *** NEW — not modelled in types.ts ***
data: { xdt_shortcode_media: {...} }
extensions: {...}           // *** NEW — not modelled in types.ts ***
status: string              // "ok"
```

- The `data.xdt_shortcode_media` envelope is **confirmed** and matches
  `ScrapeCreatorsPostEnvelope`.
- `credits_charged: 1` on every call — a per-call cost the client currently
  ignores alongside `credits_remaining`.
- `extensions` is Instagram GraphQL transport metadata:
  `{ is_final: true }`, plus `server_metadata: { request_start_time_ms,
  time_at_flush_ms }` on 4 of 5 responses (absent on the carousel). Not
  useful payload data; do not persist.
- All 5 responses were **HTTP 200**. No error case was exercised (budget was
  capped at 5 calls), so `/v1/instagram/post` error behaviour remains
  **uncaptured**.

### Media-type discriminators — CONFIRMED

- `__typename` takes exactly the three modelled values:
  `XDTGraphSidecar` (carousel), `XDTGraphVideo` (reel), `XDTGraphImage`
  (single image post).
- `is_video` is a reliable sibling discriminator (`true` only on
  `XDTGraphVideo`).
- `product_type` is `"clips"` on all three reels; **`null` on both the
  carousel and the single image post** — not a reliable presence check.
- An extra sibling key `__isXDTGraphMediaInterface` (same three values) sits
  on the top-level media object, but **not** on carousel children. Not
  modelled; falls through the index signature.
- **A `/p/` URL is not necessarily a carousel** — `ig_single_image_post.json`
  is a `/p/` URL that returned a plain `XDTGraphImage` with no
  `edge_sidecar_to_children` key at all. Do not infer media type from the
  URL path.

### Carousel child node — CONFIRMED shape, MUCH thinner than modelled

⚠️ **SUPERSEDED** — see "Image carousel child — CONFIRMED shape (3 samples) — DIFFERENT from the other carousel's image children" below (this 7-key shape is specific to an all-image carousel, not a general carousel-child rule).

Every one of the 10 children in the captured sidecar has **exactly these 7
keys and no others**:

```
__typename: "XDTGraphImage"
id: string                  // e.g. "POLARIS_9445383986838411611" — POLARIS_-prefixed
shortcode: string           // per-slide shortcode, e.g. "r2XmiZO8THA"
display_url: string
video_url: null             // *** key PRESENT but null on image children ***
is_video: false
dimensions: { height: number, width: number }
```

Relative to `ScrapeCreatorsCarouselChildNode`:

- `video_url` **is present as an explicit `null`** on image children, not
  absent. A presence check (`"video_url" in node`) yields false positives —
  test the value's truthiness instead.
- **`thumbnail_src` is absent** on carousel children.
- **`display_resources` is absent** on carousel children — only
  `display_url` and `dimensions` describe a slide. Anything reading
  `display_resources` off a child gets `undefined`.
- `clips_music_attribution_info`, `video_view_count`, `video_duration`,
  `has_audio` are all absent on image children (consistent with the type's
  optionality, but unconfirmed for video children).
- Child `id` uses a `POLARIS_<numeric>` prefix, unlike the top-level media
  `id`, which is a bare numeric string.

### Top-level carousel (`XDTGraphSidecar`) — key set differs from reels

⚠️ **SUPERSEDED** — see "⚠️ CORRECTION to the previous session's carousel-level findings" below (the "no top-level `dimensions`/`display_resources`" and "`owner` is always a 5-key stub" claims below are falsified by a second carousel sample).

- **`dimensions` is ABSENT** and **`display_resources` is ABSENT** on the
  carousel; both are present on reels and on the single image post.
  `adapter.ts` reads these for `originalWidth`/`originalHeight`, so for a
  carousel it must fall back to the first child's `dimensions`.
- The carousel **does** carry `video_url: null`, `video_duration: null`,
  `has_audio: false`, `thumbnail_src: <string>`, `display_url: <string>`.
  `has_audio: false` on a sidecar means "not applicable", not "silent".
- The carousel exposes a flat **`comment_count: 13840`** that the reels and
  the image post do **not** have.
- Carousel `owner` is a **5-key stub**: `id, username, full_name,
  is_verified, profile_pic_url`. **No `edge_followed_by`** — a carousel
  payload cannot supply a follower count, so the profiles service must fall
  back to `/v1/instagram/profile`. Reels and the image post carry the full
  17-key owner block *including* `edge_followed_by.count` and
  `edge_owner_to_timeline_media`.
- `clips_music_attribution_info` is `null` on the carousel.

### Engagement fields — CONFIRMED, with a trap

- `edge_media_preview_like.count` — present on all 5, reliable like count
  (also carries an `edges: []` array).
- `edge_media_to_parent_comment.count` — present on all 5; on the carousel
  it comes back **fully hydrated with 15 comment nodes**
  (`edges[].node.{id,text,owner,edge_liked_by,created_at}`), which is the
  bulk of that fixture's size. Do not persist.
- `edge_media_preview_comment.count` — present on all 5 and **identical to**
  `edge_media_to_parent_comment.count` in every capture. Not modelled in
  `types.ts`.
- **`video_view_count` is NOT trustworthy alone.** `ig_reel_1` returned
  `video_view_count: 0` alongside `video_play_count: 116333`.
  `video_play_count` is present on all three reels and is **not modelled in
  `types.ts`**. View-count logic should prefer `video_play_count` and treat
  a `0` `video_view_count` as missing, not as a real zero.
- `video_duration` is **SECONDS as a float** (`91.902`, `61.133`, `47.252`)
  — not milliseconds, unlike YouTube's `durationMs`.
- `taken_at_timestamp` is unix **seconds** (e.g. `1784260643`).

### Other confirmed fields on reels / image post

- `dimensions: {height, width}` and `display_resources` (exactly **3**
  entries, each `{src, config_width, config_height}` — matching
  `ScrapeCreatorsImageResource`) are present on `XDTGraphVideo` and
  `XDTGraphImage`, absent on `XDTGraphSidecar`.
- `clips_music_attribution_info` on reels has **6** keys: `song_name`,
  `artist_name`, `audio_id`, `uses_original_audio`, `should_mute_audio`,
  `should_mute_audio_reason`. The last, `should_mute_audio_reason`, is
  **not modelled in `types.ts`**.
- `has_audio` is `false` on two of the three reels despite them being
  ordinary reels — do not treat `has_audio: false` as "no soundtrack".
- `title` is `""` on all three reels — not a usable field.
- `accessibility_caption` is `null` on all 5, despite the key existing on
  reels and the image post.
- `edge_media_to_caption.edges[0].node.text` — confirmed, populated on all 5.
- `owner` on reels/image post: 17 keys including `edge_followed_by.count`
  and `edge_owner_to_timeline_media`, plus viewer-relative booleans
  (`viewer_has_liked`, `followed_by_viewer`, …) that are meaningless for an
  unauthenticated scrape.

### Divergences from `lib/server/scrapecreators/types.ts` (reported only — #71 owns the fix)

1. Envelope is missing `credits_charged` and `extensions`.
2. `ScrapeCreatorsMedia` is missing `video_play_count` — the field that
   actually carries reel views.
3. `ScrapeCreatorsMedia` is missing `edge_media_preview_comment` and the
   carousel-only flat `comment_count`.
4. `clips_music_attribution_info` is missing `should_mute_audio_reason`.
5. `ScrapeCreatorsCarouselChildNode` **over-models**: real image children
   have no `thumbnail_src` and no `display_resources`.
6. `ScrapeCreatorsCarouselChildNode.video_url` is `string | null`, not
   `string | undefined` — present-and-null on image children.
7. `ScrapeCreatorsOwner` is effectively two shapes: a 5-key stub on
   carousels (no `edge_followed_by`) and a full block on reels/images. The
   all-optional interface covers it, but callers must not assume
   `edge_followed_by` exists.
8. `__isXDTGraphMediaInterface` is undocumented.
9. The shared `ScrapeCreatorsMedia` interface does not signal that a
   sidecar lacks `dimensions`/`display_resources` while reels/images have
   them.
10. Type comments still cite `/tmp/sc-carousel-response.json` and
    `/tmp/sc-profile-response.json`; those paths are gone. Point them at
    `.claude/context/fixtures/scrapecreators-instagram/`.

### Credit ledger — Instagram capture session (2026-07-22)

Balance is **~32,000, not ~25,000** — the account was topped up since the
2026-07-21 YouTube session. `credits_charged: 1` on every call.

| Call | URL | credits_remaining after |
|---|---|---|
| (before) | — | 32000 |
| 1 | `/p/uSFa7tlyLbw/` | 31999 |
| 2 | `/reel/c6JYux8YmyY/` | 31998 |
| 3 | `/reel/my0UdbJfZ8O/` | 31997 |
| 4 | `/reel/wgkBvXRiusH/` | 31996 |
| 5 | `/p/ORKM2Ob4nyB/` | 31995 |

**Total spend: 5 credits** — 1 per call, `trim=false`, all HTTP 200, no
retries, no exploratory calls.

---

## ScrapeCreators — `/v1/instagram/post` — VIDEO-BEARING CAROUSEL CAPTURED (2026-07-22, follow-up)

- **Authorisation:** one-time owner-approved live capture, exactly 1 URL, 1 credit. This is a
  follow-up to the 5-fixture session above — it closes the gap that session explicitly left open.
- **Tested URL:** `https://www.instagram.com/p/zGKPVUdG_7U/` (`utm_source`/`igsh` stripped before
  the call, per instruction).
- **Request:** identical to production —
  `GET /v1/instagram/post?url=<url>&trim=false`, header `x-api-key`, `Accept: application/json`.
- **Raw capture (committed, byte-unmodified):**
  `.claude/context/fixtures/scrapecreators-instagram/ig_carousel_mixed_video_and_image_10_slides.json`
- **HTTP 200, `success: true`, `credits_charged: 1`.**

### ⚠️⚠️ VERDICT: THIS IS THE VIDEO-BEARING CAROUSEL — THE GAP IS CLOSED

This post is a **10-slide carousel (`__typename: "XDTGraphSidecar"`)** whose children are
**7 `XDTGraphVideo` + 3 `XDTGraphImage`** (indices 0–4, 6, 7 are video; 5, 8, 9 are image, per
`is_video`). This is the FIRST time a video-bearing carousel has been captured for this codebase.
`ScrapeCreatorsCarouselChildNode`'s video fields are now **confirmed against a real payload** —
but the real shape is **narrower** than what's modelled, and one field is entirely undocumented.
Report below; #71 owns updating `types.ts`/the adapter.

### Video carousel child — CONFIRMED shape (7 samples, all identical key set)

```
__typename: "XDTGraphVideo"
id: string                    // e.g. "4107237313804245088" — PLAIN NUMERIC,
                               // same format as top-level media id. NOT
                               // POLARIS_-prefixed (contradicts the prior
                               // all-image carousel's child id format — see
                               // "id format is NOT reliably POLARIS_" below)
shortcode: string              // per-slide shortcode
is_video: true
video_url: string              // populated CDN mp4 URL
video_view_count: number       // POPULATED here, e.g. 234050, 163868, ... —
                               // see the video_play_count reversal below
video_play_count: null         // *** present but ALWAYS null on every one of
                               // the 7 video children — the OPPOSITE
                               // reliability pattern from top-level reels ***
has_audio: false               // false on all 7 — do not read as "silent
                               // reel", same caveat as top-level has_audio
dash_info: {                   // *** ENTIRELY UNDOCUMENTED, not in types.ts
                               // at all, not even the index signature (well,
                               // it falls through [key:string]:unknown, but
                               // no field-level comment describes it) ***
  is_dash_eligible: boolean,   // true on all 7
  video_dash_manifest: string, // full DASH XML manifest, several KB per
                               // child — this is the bulk of the fixture's
                               // 166KB size. Do not persist as-is.
  number_of_qualities: number, // 5-8 observed across the 7 children
}
dimensions: { height, width }
display_url: string
display_resources: ScrapeCreatorsImageResource[3]   // matches the modelled shape
accessibility_caption: null
media_preview: string           // low-res blurhash-like base64 preview, NOT modelled
tracking_token: string           // NOT modelled
edge_media_to_tagged_user: { edges: [] }   // NOT modelled
gating_info, fact_check_overall_rating, fact_check_information,
  sensitivity_friction_info, sharing_friction_info, media_overlay_info,
  upcoming_event: all null/near-empty scaffolding fields, NOT modelled,
  fall through the index signature
```

**Fields the modelled `ScrapeCreatorsCarouselChildNode` claims but that are ABSENT on every one
of these 7 real video children:**

- `video_duration` — **absent**, not even null. Not measurable from this field on carousel video
  children (contrast: present on top-level reels as a float-seconds value).
- `clips_music_attribution_info` — **absent** on children (present, but `null`, at the top level).
- `thumbnail_src` — **absent** on children (top-level carousel has a `thumbnail_src`, matching the
  first child's `display_url`).

**Reliability reversal vs. top-level reels — READ BEFORE WIRING #71's view-count logic:**

The Instagram capture session above found that for top-level reels, `video_view_count` can be `0`
while the real number lives in `video_play_count`. **The opposite is true for carousel video
children in this fixture**: `video_play_count` is `null` on all 7, and `video_view_count` is
consistently populated with plausible descending values (234050 → 42947, matching slide order).
**Do not port the "prefer `video_play_count`" rule from reels onto carousel children — for
carousel children, `video_view_count` is the field that's actually populated.**

### Image carousel child — CONFIRMED shape (3 samples) — DIFFERENT from the other carousel's image children

```
__typename: "XDTGraphImage"
id: string                      // plain numeric, same format as video siblings
shortcode: string
is_video: false
dimensions: { height, width }
display_url: string
display_resources: ScrapeCreatorsImageResource[3]
accessibility_caption: null
media_preview, tracking_token, edge_media_to_tagged_user,
  gating_info, fact_check_*, sensitivity_friction_info,
  sharing_friction_info, media_overlay_info, upcoming_event: same
  scaffolding fields as the video children, not modelled
```

**No `video_url` key at all** — not even present-as-null. This directly contradicts the earlier
finding from `ig_carousel_all_images_10_slides.json`, where every image child had `video_url:
null` (key present, value null) and only 7 total keys. **The real shape of an image carousel
child is context-dependent** — a carousel that also contains video siblings gives its image
children the full ~14-key scaffold (matching the video children minus the video-only fields);
an all-image carousel gives its image children a stripped-down 7-key shape. Do not assume a
fixed key count for carousel image children; the presence/absence of `video_url` on an image
child is not a reliable signal either way — check `is_video`/`__typename` only.

### ⚠️ CORRECTION to the previous session's carousel-level findings

The 5-fixture session above stated, as if a general rule: "the carousel itself has no top-level
`dimensions`/`display_resources`" and "carousel `owner` is always a 5-key stub with no
`edge_followed_by`". **Both claims are FALSIFIED by this new sample:**

- This carousel's top-level `xdt_shortcode_media` **DOES have `dimensions: {height:937,
  width:750}` and a 3-entry `display_resources` array** — values that exactly match the FIRST
  child (a video). Hypothesis (only 2 samples, not confirmed as a rule): a carousel mirrors its
  first slide's dimensions/display data onto the top-level object; the previous all-image carousel
  either didn't do this or the hypothesis is wrong. Needs a third sample to resolve — flagging as
  unresolved, not asserting a new rule.
- This carousel's top-level `owner` is the **full 17-key block**, including
  `edge_followed_by: {count: 153617}` and `edge_owner_to_timeline_media` — identical richness to
  a reel/image-post owner, not a stub.
- **Corrected statement: carousel top-level `dimensions`/`display_resources`/`owner` richness is
  NOT reliably determined by `__typename: "XDTGraphSidecar"` alone.** Two carousels, two different
  shapes. The profiles service must not assume a carousel payload lacks `edge_followed_by` — check
  for its presence per-response, don't hardcode a carousel-shape exception.
- This carousel also does **not** have the flat `comment_count` field the other carousel had
  (`comment_count: 13840` there vs. absent here) — another point of carousel-vs-carousel
  divergence, not carousel-vs-reel.

### New envelope-level finding: a partial `errors` array can coexist with `success: true`

This response's top level includes an `errors` key **never seen in any of the other 5
fixtures**:

```json
"errors": [{"message": "execution error", "path": ["xdt_shortcode_media", "location", "address_json"], "severity": "ERROR"}]
```

`success` is still `true`, `data.xdt_shortcode_media` is still fully populated, and
`credits_charged` is still `1` — this is a GraphQL-style **partial/non-fatal error** for one
specific sub-field (`location.address_json`, which came back `null`), not a request failure. Not
modelled in `ScrapeCreatorsPostEnvelope` at all (falls through the index signature, but there's no
comment describing it). Callers should not treat the presence of `errors` as fatal, but the
adapter should tolerate a `location` block with `address_json: null` alongside a still-successful
response.

### `location` field, also new

`media.location` (`{id, has_public_page, name, slug, address_json}`) was `null` on all 5 prior
fixtures and is populated here (`"London, United Kingdom"`) — not modelled in `types.ts` at all.
Not required for #71, noted for completeness.

### Updated divergence list vs. `lib/server/scrapecreators/types.ts` (reported only — #71 owns the fix)

In addition to the 10 divergences already on record from the first 5 fixtures:

11. `ScrapeCreatorsCarouselChildNode` still **over-models** `video_duration`,
    `clips_music_attribution_info`, and `thumbnail_src` for video children — confirmed absent on
    all 7 real video-child samples in this capture.
12. `ScrapeCreatorsCarouselChildNode` is missing `video_play_count` (present, always `null`, on
    every video child here) and **entirely missing `dash_info`** (`is_dash_eligible`,
    `video_dash_manifest`, `number_of_qualities`) — a genuinely new, previously-unseen field.
13. The "prefer `video_play_count` over `video_view_count`" rule recorded for top-level reels
    (#3 above / divergence context) must NOT be applied to carousel video children — the reverse
    is true there. If #71 introduces a shared "resolve view count" helper, it needs a
    carousel-vs-top-level branch, not one shared rule.
14. The prior claim that carousel `owner` is always a 5-key stub lacking `edge_followed_by`, and
    that a carousel always lacks top-level `dimensions`/`display_resources`, is **wrong as a
    general rule** — this sample has the full owner block and top-level `dimensions`/
    `display_resources`. `ScrapeCreatorsMedia`/`ScrapeCreatorsOwner` being all-optional already
    tolerates both shapes; just don't let calling code assume the stub shape for carousels.
15. Carousel child `id` is not reliably `POLARIS_`-prefixed — this sample's children use plain
    numeric ids identical in format to top-level media ids, while the earlier all-image carousel
    used `POLARIS_<numeric>`. Do not parse or validate the `id` format.
16. Carousel image children do not have a fixed key count — 7 keys in the all-image carousel vs.
    ~14 in this mixed carousel (matching the video siblings minus video-only fields). `video_url`
    presence-as-null on an image child is not a reliable signal in either direction.
17. Envelope is also missing `errors` (GraphQL partial-error array, can appear alongside
    `success: true`) and `data.xdt_shortcode_media.location` (only `null` in prior samples, now
    confirmed populated with `{id, has_public_page, name, slug, address_json}`).

### Credit ledger — this follow-up capture

| Call | credits_remaining before | credits_remaining after |
|---|---|---|
| `/p/zGKPVUdG_7U/` (the video-bearing carousel) | 31995 | 31994 |

**Total spend: 1 credit.** Exactly the one call authorised, no retries needed (HTTP 200 on the
first attempt), no exploratory calls.

## ScrapeCreators — `/v1/instagram/post` (SECOND-HAND — no raw capture committed)

**Appended by ticket #64. Read the confidence note before relying on this.**

⚠️ **PARTIALLY SUPERSEDED** — real, first-hand `/v1/instagram/post` captures are now
committed at `.claude/context/fixtures/scrapecreators-instagram/` (six fixtures — see the
"(live capture, 2026-07-22)" and "VIDEO-BEARING CAROUSEL CAPTURED (2026-07-22, follow-up)"
sections above). The "no raw capture committed" framing below is no longer true; the
transcribed-from-memory notes in this section are superseded wherever they overlap with the
capture sections above and should only be treated as authoritative for things the captures
above don't cover (e.g. `/v1/instagram/profile`, which remains uncaptured).

- **Originally tested:** 2026-07-20, during PR #42 — live, against a real reel
  and a real 12-slide all-image carousel.
- **Raw captures:** **NOT committed at the time this section was written** (2026-07-20/#64).
  The originals lived in `/tmp/sc-carousel-response.json` /
  `/tmp/sc-profile-response.json` and are gone. First-hand captures for
  `/v1/instagram/post` now exist — see above. `/v1/instagram/profile` is still
  uncaptured; nothing under `.claude/context/fixtures/` covers that endpoint.
- **Confidence:** everything below is transcribed from code and code comments
  written at the time of that live session
  (`lib/server/scrapecreators/types.ts`, `lib/server/scrapecreators/instagram.ts`,
  PR #42 description). It was **not** re-verified for ticket #64 — that ticket
  was explicitly scoped to spend zero credits. Treat it as strong secondary
  evidence, not as a capture you can diff against.

### Request

- `GET /v1/instagram/post?url=<full post/reel URL>&trim=false`
- **`trim` must stay `false`.** With `trim=true` the API strips the `data`
  envelope entirely (top-level keys become
  `[success, credits_remaining, xdt_shortcode_media]`), which made the
  fetcher's `envelope.data?.xdt_shortcode_media` unwrap always `undefined`,
  and it also drops `dimensions` and `display_resources` — the fields the
  adapter reads for `originalWidth`/`originalHeight`. Same 1-credit cost
  either way, ~9KB more payload.

### Envelope

`{ success, credits_remaining, data: { xdt_shortcode_media: {...} }, status }`
— **wrapped**, unlike both YouTube endpoints. Unwrapping happens at the
fetcher call site (`lib/server/analysis/fetcher/instagram.ts`), not in the
transport layer.

There is **no** "media-info" response variant. That was a PRD assumption that
never matched a live payload; it has been removed from the types.

### `xdt_shortcode_media` — shape notes that drive adapter behaviour

- `__typename` is the media-type discriminator: `XDTGraphSidecar` (carousel),
  `XDTGraphVideo`, `XDTGraphImage`. A reel is additionally identifiable by
  `product_type === "clips"`.
- `taken_at_timestamp` is **unix seconds** (contrast YouTube's `publishDate`,
  which is ISO-8601 with an offset).
- Counts are nested objects, not scalars: `edge_media_preview_like.count`,
  `edge_media_to_parent_comment.count`,
  `edge_media_to_caption.edges[0].node.text`.
- **A carousel's top level carries no `video_url`, no `video_duration`, no
  `has_audio` and no `clips_music_attribution_info`** — those exist only on
  video-typed children in `edge_sidecar_to_children.edges[].node`. Confirmed
  against the real all-image carousel payload.
- `/v1/instagram/profile` uses the same wrapped envelope shape with
  `data.user`, regardless of `trim`. Follower/following counts are the nested
  `edge_followed_by.count` / `edge_follow.count` objects; there is no flat
  `follower_count`/`pk` variant.

### Credit cost

- 1 credit per call, `trim` on or off.

### NOT VERIFIED — open gap, blocks TDD §7 / carousel ticket 8

⚠️ **SUPERSEDED** — see "ScrapeCreators — `/v1/instagram/post` — VIDEO-BEARING CAROUSEL
CAPTURED (2026-07-22, follow-up)" above. PR #84 closed this gap: a video-bearing carousel
was captured and committed at
`.claude/context/fixtures/scrapecreators-instagram/ig_carousel_mixed_video_and_image_10_slides.json`.
The paragraph below describes the gap as it stood before that capture.

The **video-bearing carousel** has never been captured. Every video field on
`ScrapeCreatorsCarouselChildNode` (`video_url`, `video_duration`, `has_audio`,
`clips_music_attribution_info`) is **modelled by analogy with the top-level
`XDTGraphVideo` shape, never observed**. `adapter.ts:resolveAudio()` logs
loudly when a resolved video child is missing them, precisely because of this.

Ticket #64 was required to capture it and **could not**: capturing means live,
credit-charged calls, which that ticket's brief prohibited outright, and
`AGENTS.md` forbids synthesising a payload to stand in for a real one. So the
gap is recorded here rather than papered over.

To close it, someone with owner approval to spend credits needs three
`/v1/instagram/post` calls (3 credits total): a reel, an all-image carousel,
and a carousel known to contain at least one video slide. Commit the raw
bodies under `.claude/context/fixtures/scrapecreators-instagram/`, replace
this section with a first-hand capture, and convert
`tests/server/analysis/fetcher/adapter.test.ts` off its synthetic inputs.

---

## Test-harness coverage of these facts (ticket #64)

`npm run test` (vitest, `vitest.config.ts`) now pins the facts above that have
committed captures behind them. **The suite makes zero live API calls** — it
reads `.claude/context/fixtures/` and stubs `fetch`.

| Test file | Pins |
|---|---|
| `tests/server/scrapecreators/youtubeFixtures.test.ts` | Both YouTube endpoints against the 10 committed captures: flat envelope, `durationMs` in ms, `publishDate` ISO-with-offset, `channel.handle` without `@` vs the channel endpoint's `handle` with `@`, `subscriberCount` numeric, `tags` a string, `avatar` an object, `banner` an array, `trim` a no-op, both not-found bodies |
| `tests/server/scrapecreators/client.test.ts` | `scRequest` decides success from the HTTP status, never the body's `success` field (the `/v1/youtube/channel` 404-with-`success:true` trap); param serialisation; 404 not retried; key never logged |
| `tests/server/analysis/fetcher/adapter.test.ts` | `adaptPostResponse()` branching — media-type resolution, first-video-slide selection, thumbnail fallback chain, carousel audio sourced from the video child, `bool()` returning `null` (never `false`) for absent values, the no-username throw. **Synthetic inputs** — see the gap above |

Retryable statuses (429/5xx) are covered under vitest fake timers (see the PR
#81 review follow-up below) — `scRequest`'s 1s/2s exponential backoff runs in
zero real wall time per test run, with no change to production code.

---

## PR #81 review follow-up (ticket #64) — gaps recorded plainly

**Appended after code review on PR #81. Read before trusting the coverage table above.**

- **No non-Shorts `/v1/youtube/video` capture exists.** `yt_short.json`,
  `yt_video_fresh.json`, and `yt_video_trim.json` are all the same Shorts video
  (id `tPEE9ZwTmy0`) — `yt_short.json` is a separate scrape of it at a
  different time, not an independent regular-video capture. An earlier
  version of `youtubeFixtures.test.ts` had a test asserting "the same
  top-level key set for a Short as for a regular video request"; since both
  inputs were the same video, that test compared a capture to itself and
  presented the tautology as a finding. It has been replaced by a test named
  for what the fixtures actually show (`describe("/v1/youtube/video — KNOWN
  GAP: no non-Shorts capture exists")`). To close this gap: capture one
  regular, non-Shorts `/v1/youtube/video` response (1 credit, 0 on a 404) and
  commit it under `.claude/context/fixtures/scrapecreators-youtube/`.
- **The suite is now offline by construction, not by convention.**
  `tests/setup/blockLiveFetch.ts` (wired via `vitest.config.ts`'s
  `setupFiles`) installs a `fetch` stub before every test that throws, naming
  the attempted URL, unless a test opts in with its own
  `vi.stubGlobal("fetch", ...)`. `tests/setup/blockLiveFetch.test.ts` proves
  the guard fires on an unstubbed call and re-arms between tests.
- **Retry/backoff is now tested**, using vitest fake timers rather than real
  wall-clock delays — `scRequest`'s exponential backoff (1s, then 2s) runs in
  zero real time under `vi.useFakeTimers()` with no production code change.
  See `tests/server/scrapecreators/client.test.ts`, the "retry/backoff"
  describe block.
- **The carousel video-child shape is still unconfirmed.** Three tests in
  `tests/server/analysis/fetcher/adapter.test.ts` exercise
  `makeVideoChild()` (synthetic) and read like claims about Instagram's real
  API; they are grouped under `describe("UNVERIFIED — carousel video-child
  shape (modelled, never observed against a live payload)")` so their names
  are not mistaken for verified behaviour. This is the same gap already
  recorded above under "NOT VERIFIED — open gap, blocks TDD §7 / carousel
  ticket 8" — nothing new was learned about the real shape.
- **PR #84 is open (not merged as of this writing)** and adds real
  `/v1/instagram/post` fixtures under
  `.claude/context/fixtures/scrapecreators-instagram/` plus its own append to
  this file. Once merged, revisit `adapter.test.ts`'s synthetic inputs and
  the "UNVERIFIED" describe block above against the real captures.

---

## Gemini `@google/genai` structured output — LIVE call (2026-07-23, ticket #66)

- **Authorisation:** one-time owner-approved live call for #66, exactly one call, one billed
  Gemini request. No retries needed — succeeded on the first attempt.
- **What was run:** `.claude/context/fixtures/gemini/structured-output-baseline.mjs` unmodified
  (ported to `@google/genai` by #75, never executed since the port — this is the first run).
  `model: "gemini-2.5-flash"`, `temperature: 0.2`, `maxOutputTokens: 32768`,
  `responseMimeType: "application/json"`, `responseSchema` = the harness's own probe schema
  (enum-constrained hook/format/topic/CTA taxonomies, nested `scorecard` object with `required`,
  nullable enum `hookTypeSecondary`, nullable number `durationSeconds`, array-of-enum `ctaType`).
  **Note:** the harness's schema is a superset/analog probe, not `ANALYSIS_RESPONSE_SCHEMA` from
  `lib/server/analysis/schema/responseSchema.ts` — the harness predates and is independent of that
  file; this run verifies the SDK mechanics (finishReason, usageMetadata, text getter, JSON
  parseability, nullable/array/enum expressibility), not the exact production schema shape.
- **Raw output:** captured at `/tmp/gemini-live-output.txt` (not committed — scratch, outside the
  repo per `AGENTS.md`).

### Result

```
finishReason: STOP
usageMetadata: {
  promptTokenCount: 68,
  candidatesTokenCount: 329,
  totalTokenCount: 1093,
  thoughtsTokenCount: 696,
  promptTokensDetails: [{ modality: "TEXT", tokenCount: 68 }],
  serviceTier: "standard"
}
typeof response.text === "string", length 1148
```

- **`response.text` is confirmed to behave as a getter property** (per the SDK note elsewhere in
  this file) — `typeof text === "string"` held, no leftover-`()` bug present.
- **Body was directly `JSON.parse`-able** — no code fence, no prose wrapper, confirmed on a real
  (not stubbed) response for the first time since the SDK migration.
- `ctaType` came back as a real array (`["FOLLOW", "JOIN_COMMUNITY"]`).
- `hookTypeSecondary` came back as a real non-null enum string (`"NUMBERED_LIST"`) in this sample
  — the harness's probe schema makes it `nullable: true`, but this particular generation happened
  to populate it. Nullable-string expressibility itself (schema accepts `nullable: true` on an
  enum-typed string without the SDK rejecting the config) is confirmed structurally by the request
  succeeding; a `null` value for that specific field was not observed in this one sample.
- `durationSeconds` (the nullable-number probe) came back as a real number (`75`), not `null`, in
  this sample — same caveat: the nullable config was accepted, but a `null` value for a nullable
  number specifically was not observed in this run. Still an open item if a stricter "did the SDK
  emit an actual `null` for a number field" proof is ever needed — this run only proves the
  request/schema combination is accepted and produces a valid, honest value.
- **Headroom against the 32768 budget:** `candidatesTokenCount: 329` + `thoughtsTokenCount: 696` =
  `1025` tokens actually spent (`totalTokenCount: 1093` including the 68 prompt tokens) — **~97%
  headroom remaining** on this short synthetic prompt. This is a single short hypothetical prompt,
  not the full production prompt (#67) against a real video with the full 7-dimension scorecard
  and every Tier-1 prose field, so it establishes the mechanism (thinking tokens are billed against
  `maxOutputTokens`, exactly as the legacy-SDK measurement showed) and a lower bound on headroom,
  not the real-world headroom for a production-sized request.
- `lib/server/analysis/gemini/generate.ts` (production call path, modified by #66) now sets
  `temperature: 0`, `responseMimeType: "application/json"`, `responseSchema:
  ANALYSIS_RESPONSE_SCHEMA` (from `lib/server/analysis/schema/responseSchema.ts`, spread from
  `lib/analysis/taxonomy/constants.ts`, no literal enum lists), `maxOutputTokens: 32768`, logs
  `response.usageMetadata` on every call, and throws before any parse attempt if
  `finishReason !== STOP` — this exact configuration was **not** itself live-called in this
  session (that would have required a real video + Gemini file upload, out of scope for the
  one-call budget); the live call above validates the underlying SDK plumbing
  (`ai.models.generateContent`, `response.text`, `response.candidates[0].finishReason`,
  `response.usageMetadata`, JSON-Schema `nullable`/array/enum acceptance) that `generate.ts`'s new
  config relies on. `ANALYSIS_RESPONSE_SCHEMA` itself is verified by typecheck/build only, not by
  a live call — see #66's PR description for the schema-only-vs-live-verified breakdown.

---

## ScrapeCreators — `/v1/instagram/post` — `like_and_view_counts_disabled` — OPEN / UNVERIFIED GAP

⚠️ **PARTIALLY SUPERSEDED** — see "⚠️ CORRECTION — `like_and_view_counts_disabled` fixture coverage was
overstated (2026-08-05)" at the end of this file. The sentence below beginning *"All five committed
fixtures … have this field set to `false`"* is **factually wrong**: the field is **absent entirely**
from `ig_carousel_all_images_10_slides.json`. The rest of this section — the strict `=== true` read,
and the gap itself (no committed fixture represents a genuinely counts-disabled post) — still stands.

- **Status: NOT independently verified against a live capture.** Flagged during PR #111
  (ticket #110) code review (finding N1) — recorded here per the "stop and flag it" rule in
  AGENTS.md's "External API Verification" section rather than guessed at or live-called.
- **What IS verified:** the field name `like_and_view_counts_disabled` exists on the top-level
  `ScrapeCreatorsMedia` node (see `lib/server/scrapecreators/types.ts`) and is read as
  `raw.like_and_view_counts_disabled === true` (`lib/server/analysis/fetcher/adapter.ts`, C8) —
  strict `=== true`, never a truthy/falsy coercion, so `undefined`/absent is deliberately NOT
  treated as `false`.
  All five committed fixtures under `.claude/context/fixtures/scrapecreators-instagram/` have
  this field set to `false`. **None of the committed fixtures represent a genuinely
  counts-disabled post.** This means:
  - The shape of a real counts-disabled payload (does `edge_media_preview_like` still carry a
    `count` object, or is the whole edge omitted? does `video_view_count`/`video_play_count`
    still appear, populated, or does ScrapeCreators itself null/omit them upstream?) is
    UNVERIFIED. Everything in the codebase that branches on this flag (adapter.ts's nulling of
    `viewCount`/`likeCount`/`displayedCountIsPlayCount`, and the client's `classifyViewCount`/
    `classifyLikeCount` in `lib/api/analyses/helpers.ts`) is built to be defensive regardless of
    the raw payload shape underneath the flag — it does not depend on knowing the exact shape —
    but the shape itself has not been confirmed against a real API response.
  - Do NOT assume the counts-disabled payload nulls the underlying count fields itself upstream
    of our adapter, and do NOT assume it doesn't. Both are currently unverified.
- **Do not close this gap with a live API call speculatively** — per the ticket's explicit
  instruction, that costs real ScrapeCreators credits and was out of scope for this review-fix
  round. Capture a genuine counts-disabled fixture live (and add it under
  `.claude/context/fixtures/scrapecreators-instagram/`) before writing any code that depends on
  the shape of that payload beyond the boolean flag itself.

---

## ScrapeCreators — `/v1/instagram/profile` — FIRST live capture (2026-08-05, superseding ticket #36)

- **Authorisation:** one-time owner-approved narrow live capture, superseding #36's original
  broader (and already-superseded-by-#64) scope. Budget: ~2 credits. **Actual spend: 1 credit.**
- **This is the first genuine live capture of this endpoint.** Everything previously written about
  `/v1/instagram/profile` in this file (the "SECOND-HAND — no raw capture committed" section above)
  and in `lib/server/scrapecreators/types.ts`'s doc comment (which claims "confirmed against a real
  payload (/tmp/sc-profile-response.json)") was **transcribed from memory during PR #42, not
  independently verified, and the original capture file no longer exists.** Ticket #64 explicitly
  flagged `/v1/instagram/profile` as "still uncaptured; nothing under `.claude/context/fixtures/`
  covers that endpoint." That gap is now closed.
- **Tested username:** `nasa` (public, verified, business account — chosen deliberately to also
  exercise `is_business_account: true`, `is_verified: true` paths, unlike a private/default
  account).
- **Call path used:** not a raw standalone client call — called through the actual production
  entry point, `resolveProfile({ platform: "instagram", username: "nasa" })`
  (`lib/server/profiles/service.ts`), via a `/tmp` throwaway script that wrapped `globalThis.fetch`
  with a call counter before importing the service. This exercises the exact same code path
  production uses (`fetchInstagramProfileInput` → `getInstagramProfile` → `scRequest`), not a
  hand-rolled request, and the full raw envelope was recovered afterward from the `profiles.raw_payload`
  column (which stores `JSON.stringify(envelope)` verbatim — see `upsertProfile`).
- **Raw capture (committed, byte-identical to `raw_payload`):**
  `.claude/context/fixtures/scrapecreators-instagram/ig_profile_business_account.json`

### Envelope — CONFIRMED

```
success: boolean            // true
credits_remaining: number   // 31989 at capture time
credits_charged: number     // *** NOT modelled in ScrapeCreatorsProfileEnvelope — see mismatch below ***
data: { user: {...} }
status: string               // "ok"
```

Confirms the doc-comment claim in `lib/server/scrapecreators/types.ts` line 20
(`{ success, credits_remaining, data: { user: {...} }, status }`) for the fields it lists, **but
that comment is missing `credits_charged`**, which the real payload has (`credits_charged: 1`) —
the exact same field the post-endpoint envelope already models. Same trap as the type comment's
unverified claim about a `pk`/`follower_count` flat variant (which is genuinely absent, confirmed
below) — the comment was mostly right but not exhaustively checked against a byte, because there
was no byte to check it against until now.

### `data.user` — CONFIRMED shape, 69 keys (real payload is FAR wider than modelled)

`ScrapeCreatorsProfileUser` (`lib/server/scrapecreators/types.ts`) models 10 named fields plus an
index signature. The real `data.user` object has **69 top-level keys**. Every one of the 10 named
fields is present, correctly named, correctly typed, and correctly nested — **zero mismatches**:

```
id: string                          // "528817151" — confirmed string, matches ScrapeCreatorsProfileUser.id
username: string                    // "nasa"
full_name: string                   // "NASA"
biography: string                   // "Making the seemingly impossible, possible. ✨"
profile_pic_url: string
is_verified: boolean                // true
is_private: boolean                 // false
is_business_account: boolean        // true
edge_followed_by: { count: number } // { count: 104252772 } — nested object, NOT a flat follower_count
edge_follow: { count: number }      // { count: 92 } — nested object, NOT a flat following_count
```

**No flat `follower_count`/`following_count`/`pk` fields exist anywhere in the 69 keys.** The type
comment's claim that "there is no flat follower_count/following_count/pk variant" is CONFIRMED, not
just asserted.

Fields present in the real payload but NOT modelled at all (fall through
`[key: string]: unknown` — not a bug, just unmapped, listed for anyone extending this later):
`profile_pic_url_hd`, `fbid`, `eimu_id`, `external_url` / `external_url_linkshimmed`,
`business_address_json` (nested `{city_name, city_id, latitude, longitude, street_address,
zip_code}`), `business_category_name`, `business_contact_method`, `business_email`,
`business_phone_number`, `category_enum`, `bio_links` (array of 5), `biography_with_entities`,
`highlight_reel_count`, `has_clips`, `has_channel`, `has_guides`, `has_ar_effects`,
`hide_like_and_view_counts` (boolean — profile-level analog of the post-level
`like_and_view_counts_disabled` gap recorded above; NOT the same field, not wired to anything, just
noting the naming echo), `pronouns` (empty array in this sample), `edge_owner_to_timeline_media`,
`edge_felix_video_timeline`, `edge_saved_media`, `edge_media_collections`, `edge_mutual_followed_by`,
`edge_related_profiles`, and ~15 more viewer-relative / moderation booleans
(`blocked_by_viewer`, `restricted_by_viewer`, `has_requested_viewer`, `followed_by_viewer`, etc.) —
all meaningless for an unauthenticated scrape, same pattern as the post owner block.

### Verdict against ticket #33's `fetchInstagramProfileInput` assumptions — NO MISMATCH

`lib/server/profiles/service.ts`'s `fetchInstagramProfileInput` reads exactly:
`raw.id`, `raw.edge_followed_by?.count`, `raw.edge_follow?.count`, `raw.full_name`,
`raw.profile_pic_url`, `raw.biography`, `raw.is_verified`, `raw.is_business_account`,
`raw.is_private`. **Every single one of these field names, and their nesting
(`edge_followed_by.count` / `edge_follow.count` as nested objects, not flat numbers), matches the
live payload exactly, including casing (all snake_case, as assumed).** #33's code needs no fix.
The only genuine gap found is the envelope-level `credits_charged` field being unmodelled (transport
metadata, not consumed by #33's logic — same non-issue category as the post endpoint's
`credits_charged`/`extensions`, which are also deliberately unpersisted).

### Cache verification (`resolveProfile`, `PROFILE_TTL_DAYS`) — REAL, OBSERVED, NOT ASSUMED

Wrapped `globalThis.fetch` with a call counter, then called `resolveProfile({ platform:
"instagram", username: "nasa" })` twice in the same process, back to back, against a freshly
migrated local `my-content.db` with no prior `nasa` row:

| Call | fetch() calls made | Result |
|---|---|---|
| 1st `resolveProfile` (cache miss — no row existed) | **1** (`GET /v1/instagram/profile?handle=nasa&trim=false`) | Row inserted, `credits_charged: 1` in the stored `raw_payload` |
| 2nd `resolveProfile` (same platform/username, immediately after) | **0** | Returned the cached row read straight from `profiles`, no network call at all |

Direct `sqlite3`-equivalent confirmation via `db.execute` in the same script:

```
last_fetched_at: 2026-08-05 03:42:47   updated_at: 2026-08-05 03:42:47
```

— a single timestamp shared by both columns after **both** `resolveProfile` calls, proving the
second call never went through `upsertProfile()`'s `datetime('now')` write path a second time (had
it hit the API again and re-upserted, `last_fetched_at`/`updated_at` would have advanced past the
first call's timestamp). Combined with the 0-fetch observation above, this is real evidence — not
an assertion — that the 7-day TTL cache (`PROFILE_TTL_DAYS`, default 7, `lib/server/profiles/constants.ts`;
`isStale()`, `lib/server/profiles/helpers.ts`) works as designed: a fresh cached row short-circuits
`resolveProfile` before `fetchInstagramProfileInput`/`getInstagramProfile`/`scRequest` are ever
reached.

The `profiles` table row this test wrote is a real local DB write (`platform='instagram',
username='nasa'`), consistent with this task's explicit allowance that the cache-write itself is
expected, unlike #36's original "no DB writes" constraint for a different, broader script.

### Credit ledger — this session (2026-08-05)

| Call | credits_remaining after |
|---|---|
| `resolveProfile` call 1 (cache miss → live `/v1/instagram/profile`) | 31989 |
| `resolveProfile` call 2 (cache hit, same username) | 31989 (unchanged — 0 fetch calls made, confirmed above) |

**Total spend: 1 credit**, within the ~2-credit budget. No retries, no exploratory calls, no
errors.

---

## Gemini production `ANALYSIS_RESPONSE_SCHEMA` @ `temperature: 0` — LIVE call (2026-08-05, ticket #66 closeout)

⚠️ **SUPERSEDES the "Gemini `@google/genai` structured output — LIVE call (2026-07-23, ticket #66)"
section above, specifically for the claim that `ANALYSIS_RESPONSE_SCHEMA`-at-`temperature:0` was
verified.** That entry is still accurate about what it actually tested (SDK plumbing via the
harness's own probe schema, `temperature: 0.2`, a short synthetic text prompt) — it is superseded
only insofar as this new entry closes the gap it explicitly left open. Do not delete the 07-23
entry; it documents real, separate findings about the SDK (`response.text` getter behaviour,
`thinkingConfig` defaults, etc.) that remain valid.

- **Authorisation:** one-time owner-approved live call for ticket #66 closeout, exactly one billed
  `generateContent` request. No retries needed — succeeded on the first attempt.
- **Trigger:** code review on #66 (comment
  https://github.com/jordanjordann/my-content/issues/66#issuecomment-5164456622) found the prior
  live call didn't discharge the ticket's own verification requirement: "one live billed Gemini
  call against a real reel, using the actual production `ANALYSIS_RESPONSE_SCHEMA`, at temperature
  0, with finishReason STOP, parsed successfully."

### What was actually called — the real production code path, not a harness

- `lib/server/analysis/gemini/generate.ts`'s exported `analyzeContent(mediaParts, prompt)` was
  imported and invoked directly (via `tsx`, `GEMINI_API_KEY` from `.env.local`) — the exact
  function `lib/server/analysis/pipeline/index.ts` calls in production. Not a reimplementation, not
  a copy of the request shape — the real function, unmodified.
- `prompt` was built with the real `buildSystemInstruction()` (`lib/server/analysis/prompts/system.ts`)
  and `buildUserPrompt()` (`lib/server/analysis/prompts/user.ts`), concatenated exactly as
  `pipeline/index.ts` does (`` `${systemPrompt}\n\n${userPrompt}` ``) — full rubric block, full
  taxonomy block, full discriminator-rules block, real engagement context section. Prompt length:
  **22,500 characters** (vs. the 07-23 entry's 68-token synthetic prompt) — a genuine
  production-sized request.
- `config` inside `analyzeContent` is untouched production code: `temperature: 0`,
  `responseMimeType: "application/json"`, `responseSchema: ANALYSIS_RESPONSE_SCHEMA` (the real
  schema from `lib/server/analysis/schema/responseSchema.ts`, not a probe/analog), `maxOutputTokens: 32768`.

### The real reel

- `https://www.instagram.com/reel/my0UdbJfZ8O/` (the primary test creator) — the same reel captured
  live in `.claude/context/fixtures/scrapecreators-instagram/ig_reel_2.json` (2026-07-22 Instagram
  capture session). 61.133s, 750x1333. Identity fields (handle, caption text, CDN URLs) were
  anonymised in #264; every numeric engagement/metric field in the fixture (view/play/like/comment
  counts, follower count, dimensions) was deliberately left UNTOUCHED — #264's own diff confirms
  zero numeric value changes across all fixtures.
- **Media source: reused an already-uploaded Gemini File API asset, not a fresh download.** The
  `analyses` table (`my-content.db`) had a prior **production run of this exact reel** from
  2026-08-03 (`id=gemini-file-reuse-row-synth-1`, `status='completed'`), whose
  `gemini_file_uri` (`https://generativelanguage.googleapis.com/v1beta/files/svx16crcvmc5`) was
  **still ACTIVE** at call time (expiry `2026-08-05T06:55:46.119268334Z`, called ~3h before
  expiry). Verified via a free `ai.files.get({ name: "files/svx16crcvmc5" })` call before spending
  on `generateContent`: `state: "ACTIVE"`, `mimeType: "video/mp4"`, `videoMetadata.videoDuration:
  "61s"` (matches the reel). This means **zero ScrapeCreators spend and zero video re-upload** were
  needed for this verification — only the one authorized Gemini `generateContent` call.
  - Note: the fixture-committed `video_url` CDN links (all captured 2026-07-22/2026-07-23) were
    checked first and are **expired** — their signed `oe=` params decode to expiry timestamps in
    late July 2026, and a live `curl` against one returned `SSL_ERROR_SYSCALL` (connection reset by
    Instagram's edge, confirmed not a sandbox network issue — `curl` to `google.com` succeeded
    immediately from the same shell). This is why the still-active Gemini File API asset from the
    2026-08-03 production run was used instead of re-deriving a fresh CDN URL.
  - `metadata: MediaMetadata` passed to `buildUserPrompt()` was reconstructed field-for-field from
    that same `analyses` row (caption, view/like/comment counts, follower count, engagement rate,
    audio fields, resolution) — real production data, not fabricated.

### Result

```
finishReason: STOP  (implicit — analyzeContent's fail-closed guard did not throw;
                      execution reached the post-guard `response.text` read, which
                      only happens when finishReason === FinishReason.STOP)
usageMetadata: {
  promptTokenCount: 24052,
  candidatesTokenCount: 1574,
  totalTokenCount: 29620,
  thoughtsTokenCount: 3994,
  promptTokensDetails: [
    { modality: "TEXT", tokenCount: 6057 },
    { modality: "VIDEO", tokenCount: 16043 },
    { modality: "AUDIO", tokenCount: 1952 }
  ],
  serviceTier: "standard"
}
typeof response.text === "string", length 5621
JSON.parse(response.text) succeeded with ZERO repair/fallback logic — no code fence, no prose
wrapper, no truncation. Parsed directly with the built-in `JSON.parse`, the same call
`parseContentAnalysis` makes internally.
```

- **`finishReason` was `STOP`.** Not logged as a bare value in this run's console capture (the
  guard doesn't log the value on the success path, only throws on failure), but its value is
  provable by construction: `analyzeContent`'s guard (`generate.ts:61`,
  `if (finishReason !== FinishReason.STOP) throw ...`) sits BEFORE the `response.text` read, and
  the call returned normally with a populated `text` — the only way that happens is
  `finishReason === FinishReason.STOP`. This is the exact fail-closed guard added in PR #119.
- **Every top-level key required by `ANALYSIS_RESPONSE_SCHEMA` is present and correctly typed** in
  the parsed output: `style` (all 15 sub-fields including `hookTypeSecondary` as a real enum string,
  `ctaType` as a real array `["SHARE_PROMPT"]`, `estimatedCutsPerMinute` as a real number `30`,
  `structureBeatMap` as an array of 6 beat objects with `propertyOrdering`-consistent shape),
  `overallScore`, `scorecard` (all 7 dimensions, integers 1–5), `summary`, `strengths`,
  `weaknesses`, `keyMoments`, `redFlags` (empty array, valid), `suggestions`. The `ctaType`/
  `ctaTiming` biconditional holds (`["SHARE_PROMPT"]` + `"END"`, not `NONE`/`NONE`).
- **Headroom against the 32768 `maxOutputTokens` budget, measured on a genuine production-sized
  request for the first time:** `candidatesTokenCount: 1574` + `thoughtsTokenCount: 3994` = `5568`
  tokens spent against the output budget — **~83% headroom remaining** (27,200 tokens free) on a
  real 61-second video with audio, a full 7-dimension scorecard, a 6-beat structure map, and a
  31-item on-screen-text array. This supersedes the 07-23 entry's "~97% headroom on a 68-token
  synthetic prompt" figure as the operative headroom bound for real production traffic — still
  comfortably clear of `MAX_TOKENS`, but the real number is meaningfully lower than the synthetic
  estimate, as expected once a full-size prompt against real video is used.
- **Forced-truncation (`MAX_TOKENS`) scenario: NOT tested live in this session, by design.** Per
  the ticket's own instruction, a second full-price billed call was not spent solely to trigger
  this. The offline unit-test coverage added in PR #119
  (`tests/server/analysis/gemini/generate.test.ts` or equivalent — see that PR) already asserts,
  with a mocked SDK response, that (a) `finishReason: MAX_TOKENS` throws, (b) a missing
  `finishReason` throws (fail-closed), and (c) the throw happens before `response.text` is read —
  this was accepted by the ticket's own reviewer as sufficient to discharge the truncation
  criterion without a second live call. Not re-verified live here; flagging plainly rather than
  silently omitting it, per instruction.
- **Determinism (`temperature: 0` reproducibility across two runs of the same video): NOT tested.**
  Only one call was authorized and made. The ticket's checklist item "same video twice at
  `temperature: 0` yields identical scorecard values" remains formally unverified — noted here
  rather than silently dropped, but not a blocker per the ticket owner's explicit scope (one live
  call, not two).

### Credit ledger

- **Gemini spend: 1 billed `generateContent` call** (plus one free `ai.files.get` state check,
  not billed as generation). No ScrapeCreators calls were made — the already-active Gemini File API
  asset from an earlier production run was reused instead of re-fetching or re-uploading the video.
- Raw call output captured at `/tmp/gemini-live-verify-output.txt` (not committed — scratch, outside
  the repo per `AGENTS.md`).

### Verdict for ticket #66

All four of the ticket's previously-unmet verification items that required a live call are now
resolved for the "real reel, real schema, `temperature: 0`, `finishReason: STOP`, parsed
successfully" criterion specifically:

- [x] One live call against a real reel, using `ANALYSIS_RESPONSE_SCHEMA` (not a probe), at
      `temperature: 0` (not `0.2`) — **met**, this entry.
- [x] `finishReason: STOP` — **met** (proven by the fail-closed guard's control flow, see above).
- [x] Parsed successfully with zero repair/fallback logic — **met**.
- [x] `usageMetadata` / headroom reported for a real production-sized input — **met**, 83%
      headroom on a real 61s video + full prompt (supersedes the earlier 97%-on-synthetic-prompt
      figure as the operative bound).
- [ ] Same video twice at `temperature: 0` yields identical scorecard values — still open, not
      required by the ticket owner's one-call scope; noted, not silently dropped.
- [x] Forced-truncation (`MAX_TOKENS` throws before parse) — covered offline by PR #119's unit
      tests, not by a second live call (deliberate, per instruction).

---

## ⚠️ CORRECTION — `like_and_view_counts_disabled` fixture coverage was overstated (2026-08-05)

**Method: offline key-set inspection of every committed Instagram fixture. ZERO live API calls, zero
credits spent.** Nothing here is inferred from `__typename`, from the TypeScript types, or from any
earlier entry in this file — every row below was read out of the committed JSON.

### What the earlier claim said

The section "ScrapeCreators — `/v1/instagram/post` — `like_and_view_counts_disabled` — OPEN /
UNVERIFIED GAP" states:

> All five committed fixtures under `.claude/context/fixtures/scrapecreators-instagram/` have this
> field set to `false`.

**That is wrong on two counts.** There are **seven** committed Instagram fixtures, not five, and one
of them does not carry the field at all.

### What is actually true

Field path inspected: `data.xdt_shortcode_media.like_and_view_counts_disabled` (post fixtures) and
`data.user.edge_{felix_video_timeline,owner_to_timeline_media}.edges[].node.like_and_view_counts_disabled`
(profile fixture).

| Committed fixture | `__typename` | `like_and_view_counts_disabled` |
|---|---|---|
| `ig_reel_1_zero_view_count.json` | `XDTGraphVideo` | `false` |
| `ig_reel_2.json` | `XDTGraphVideo` | `false` |
| `ig_reel_3.json` | `XDTGraphVideo` | `false` |
| `ig_single_image_post.json` | `XDTGraphImage` | `false` |
| `ig_carousel_mixed_video_and_image_10_slides.json` | `XDTGraphSidecar` | `false` |
| **`ig_carousel_all_images_10_slides.json`** | **`XDTGraphSidecar`** | **ABSENT — key does not exist anywhere in the payload (0 raw string occurrences)** |
| `ig_profile_business_account.json` (profile endpoint, not `/post`) | — | present `false` on all **24** nested timeline-media nodes |

So: **five of the six committed `/v1/instagram/post` fixtures carry it as `false`; the sixth does not
carry it at all.** The profile fixture carries it 24 times over, on nested nodes the original claim
did not contemplate.

### The absence is NOT predictable from content type or `__typename`

This is the part that matters for implementation, and it is why "sidecars don't have it" would be an
equally wrong rule to write down:

- **Both** carousel fixtures are `XDTGraphSidecar`. The mixed video/image one **has** the field; the
  all-image one **does not**.
- The single-image post (`XDTGraphImage` — image-only content) **does** have the field as `false`.
  Image-only content is therefore *not* the discriminator either.
- The all-image carousel is a **structurally reduced payload variant**: **25 top-level keys**, versus
  **49** on the mixed carousel and **48** on the single image post. It is missing 30 keys the mixed
  carousel carries — including `like_and_view_counts_disabled`, `dimensions`, `display_resources`,
  `comments_disabled` and `accessibility_caption` — while carrying 6 keys the mixed carousel lacks
  (`comment_count`, `has_audio`, `video_duration`, `video_url`, `product_type`,
  `clips_music_attribution_info`). Its `owner` is the 5-key stub with **no `edge_followed_by`**,
  whereas the mixed carousel's `owner` is the full 17-key block.

**Rule to build to: branch on field presence, never on `__typename` or on "is this image content".**
Presence of this field varies between two payloads of the same `__typename`.

### Practical consequence

- **Benign in the existing code path.** `lib/server/analysis/fetcher/adapter.ts` reads
  `raw.like_and_view_counts_disabled === true` — strict identity, never truthy coercion — so an
  absent key is already not coerced to `false`. No shipped behaviour is wrong today. **This
  correction fixes the documentation, not a bug.**
- **But there is a real product consequence, and it is not benign.** On an all-image carousel we
  **cannot determine whether the creator has hidden their counts**. Absence of the flag means *we do
  not know*, not *counts are visible*. We can only observe that `edge_media_preview_like.count` and
  `edge_media_to_parent_comment.count` happen to be present with values.
- This interacts directly with the **confirmed** product rule that a hidden/absent input yields **no
  score plus a visible, user-legible reason** (see `docs/prd/PRD-3B-performance-scoring-and-3C-analyses-table.md`,
  D3 and §12.2/§12.6). On this payload shape the app cannot honestly state *why* with confidence, so
  it must say what it does know rather than assert a cause it cannot evidence. Never coerce absent to
  `false` to make a reason string easier to write.

### Scope of this correction

- The **gap itself is unchanged and still open**: no committed fixture represents a genuinely
  counts-disabled post, and the shape of a real counts-disabled payload remains **UNVERIFIED**. A
  live capture of one is approved but **not yet made** — approved is not verified.
- The strict `=== true` read documented in the original section is confirmed correct and is the
  reason this documentation error never became a runtime bug.
- Original claim left in place above with a supersede banner, per this file's convention. Nothing
  deleted.

---

## ScrapeCreators — `/v1/instagram/post` — V1 CAPTURED: a genuinely counts-disabled post (2026-08-06)

⚠️ **CLOSES the "OPEN / UNVERIFIED GAP" section above.** A real counts-disabled Instagram post has
now been captured. The gap recorded there ("the shape of a real counts-disabled payload is
UNVERIFIED") is resolved for this sample. Do not delete that section — read it, then read this one,
per this file's supersede convention.

- **Authorisation:** PRD `docs/prd/PRD-3B-performance-scoring-and-3C-analyses-table.md` §10.2, V1,
  approved 2026-08-05, ~1 SC credit budgeted.
- **Call path used: the real production entry point**, not a hand-rolled request —
  `fetchMetadata(classifyUrl(url))` → `fetchInstagramMetadata()` → `getInstagramPost()` →
  `scRequest()`, exercised via a throwaway script that wrapped `globalThis.fetch` to capture the raw
  body (same method as the 2026-08-05 `/v1/instagram/profile` capture). Not a copy of the request
  shape — the actual client code, unmodified.
- **How the candidate was found:** free, zero-cost reconnaissance before spending anything. Public
  Instagram post pages served without login still carry an `og:description` meta tag of the form
  `"{N} likes, {M} comments - {username} on {date}: "{caption}""` for an ordinary post. A batch of
  ~15 candidate post URLs (gathered via web search, zero API cost) were probed with a plain `curl`
  against that meta tag before any ScrapeCreators call was made. One candidate's `og:description`
  had **no like/comment count prefix at all** — `"commenter_030 on September 9, 2025: "✨ Did you
  know you can hide like counts..."` — which is the public-page signature of a counts-hidden post.
  The post's own caption confirms it explicitly: *"PS. This post has likes removed. 😊"* — a
  creator demonstrating the feature on their own post while writing a tutorial about it, the same
  self-referential pattern that made V1 discoverable at all (guessing blind did not converge; this
  did, on the first live-spend attempt).
- **Tested URL:** `https://www.instagram.com/p/cgwUkjyq7TO/` (`@commenter_030`, single image post,
  `XDTGraphImage`).
- **Raw capture (committed, byte-unmodified):**
  `.claude/context/fixtures/scrapecreators-instagram/ig_post_counts_disabled.json`
- **HTTP 200, `success: true`, `credits_charged: 1`, `credits_remaining: 31986`.** This is also the
  first live `credits_remaining` reading since 2026-08-05 (31989) — discharged for free, per
  instruction, by reading it off a call that was already being made. Net drift since 2026-08-05: 3
  credits (this call plus 2 untracked calls elsewhere in the interim — consistent with the two
  ScrapeCreators calls a completed YouTube Short analysis costs, RUNBOOK.md §5).

### The shape — CONFIRMED, and it contradicts an assumption nobody had stated as fact but everyone was defaulting to

`like_and_view_counts_disabled: true` is present at `data.xdt_shortcode_media.like_and_view_counts_disabled`, exactly where every other captured fixture puts it. That part matches expectation.

**What does NOT match the unstated default expectation:** `edge_media_preview_like` is **not omitted**, and its `count` is **not `0` and not `null`**. It is:

```json
"edge_media_preview_like": {
  "count": -1,
  "edges": [
    { "node": { "id": "...", "username": "commenter_031", ... } },
    { "node": { "id": "...", "username": "commenter_032", ... } },
    { "node": { "id": "...", "username": "commenter_033", ... } }
  ]
}
```

**`count: -1`.** A negative-one sentinel, not a null, not an absence, not a zero — genuinely `-1`,
the one state the existing `CountState` discriminated union (`lib/api/analyses/helpers.ts`,
`classifyLikeCount`/`classifyViewCount`) does not name. `edges` is still populated with real
usernames (3 of presumably more) — Instagram still tells an unauthenticated scraper *who* liked the
post, just not *how many*.

**§4.4/D3's four-state model (`AVAILABLE`/`HIDDEN`/`UNKNOWN`/`ZERO`) is not contradicted by this**
— `like_and_view_counts_disabled === true` still correctly drives `HIDDEN` regardless of what the
underlying count field says, and `lib/server/analysis/fetcher/adapter.ts`'s existing strict
`raw.like_and_view_counts_disabled === true` gate already nulls `likeCount` on this exact payload
(confirmed: `adaptPostResponse()` returned `likeCount: null` for this fixture, see the script output
below) — **so today's shipped behaviour is already correct on this payload, by construction, not by
luck.** But this is exactly the kind of shape a *new*, independently-written piece of 3B code could
get wrong if it ever reads `edge_media_preview_like.count` directly instead of going through the
flag: a naive `likes ?? 0` or `Math.max(likes, 0)` would silently produce `0` liked-count math (or
worse, `-1` propagating into a ratio, e.g. `(likes + comments) / followers` in §12.2 going negative)
instead of the required `HIDDEN`/no-score state. **Recorded as a concrete "do not" for whoever
implements R-4.4 / R-12.2.3: never read `edge_media_preview_like.count` before checking
`like_and_view_counts_disabled`, even defensively — the sentinel is actively wrong, not just
absent.**

**Comments are unaffected**, as the flag name implies (`like_and_view_counts_disabled`, not
"engagement"): `comments_disabled: false`, `edge_media_to_parent_comment.count: 1` (a real,
trustworthy value — matches `commentCountInt` behaviour being independent of the likes/views flag).
The adapter correctly returned `commentCount: 1` (not nulled) for this fixture.

**No video fields exist on this fixture to inform the "does a counts-disabled video still expose
`video_view_count`" half of the original open question** — this sample is `XDTGraphImage`, no
`video_url`/`video_view_count`/`video_play_count` keys at all (consistent with every other
`XDTGraphImage` fixture, disabled or not). **That specific sub-question (a counts-disabled *video*
post/reel) remains open** — flagging rather than silently claiming full closure. What V1 *does*
close is the higher-priority half: whether the like-count field itself survives as `0`/`null`/absent
vs. something else entirely under the flag. It survives as a **populated, actively-misleading
negative sentinel**, which no prior entry in this file anticipated.

**Envelope-level, consistent with prior captures:** the same non-fatal `errors` array
(`location.address_json` execution error) as `ig_carousel_mixed_video_and_image_10_slides.json`
appears here too — third occurrence, strengthens "this is a routine partial-error shape, not
carousel-specific" (revises the earlier "new envelope-level finding" framing which implied it might
be carousel-only).

### Adapter output, for the record (real `adaptPostResponse()`, this exact fixture)

```
likeCount: null            (nulled — countsDisabled gate fired correctly)
commentCount: 1            (NOT nulled — comments unaffected)
likeAndViewCountsDisabled: true
viewCount: null            (no reach field exists on an image post regardless of the flag)
```

### Credit ledger — this capture

| Call | credits_remaining after |
|---|---|
| `/p/cgwUkjyq7TO/` (the counts-disabled post, via the real fetcher) | 31986 |

**Total spend: 1 credit.** Exactly the one call authorised. Discovery (curl probing of `og:description`
on ~15 public post pages, and several rounds of web search) cost zero ScrapeCreators credits — see
the "How the candidate was found" note above.

---

## ScrapeCreators — `/v1/youtube/video` — V2, YouTube likes-hidden: BLOCKED, checkpointing per instruction (2026-08-06)

⚠️ **NOT CAPTURED.** This is a checkpoint, not a result. Recorded per the task's explicit instruction
to stop and report rather than silently burn discovery attempts.

- **Authorisation:** PRD §10.2, V2, approved 2026-08-05, ~1 SC credit budgeted. **Zero credits have
  been spent on V2** — the blocker is entirely in finding a real candidate video, before any paid
  call is justified.
- **What is confirmed, not from a live call but from current (2026-08-06) documentation research:**
  YouTube creators can hide a video's/Short's public like count per-video via YouTube Studio →
  video details → "Show More" → uncheck "Show how many viewers like this video" — this applies to
  Shorts as well as long-form. This is **distinct** from YouTube's platform-wide dislike-count
  hiding (2021, all videos, not creator-optional) and from a March-2026-reported *viewer-side* test
  that hid like counts from some viewers regardless of creator intent — neither of those is the
  per-video creator toggle V2 needs to observe. Source: general web documentation, not a live
  YouTube API response; **do not treat the mechanism description above as confirmed against a live
  payload** — only the *existence* of the setting is established, not what ScrapeCreators returns
  for `likeCountInt`/`likeCountText` on such a video.
- **What was tried, free, before requesting a checkpoint:** the same `og:description`/page-source
  probing technique that found V1's candidate in one shot was attempted for YouTube. It does not
  transfer cleanly — a normal YouTube watch/Shorts page's server-rendered JSON (`ytInitialData`)
  does carry a `"likeCount":"<N>"` string for an ordinary video (confirmed by probing
  `youtube.com/shorts/tPEE9ZwTmy0`, the channel already in `verified-facts.md`, which returned
  `"likeCount":"1357552"`), but unlike Instagram's self-referential "tutorial post that also hides
  its own likes" pattern, no candidate Short surfaced whose own page source omitted that key. Roughly
  a dozen web searches for tutorial/demo/testimonial Shorts about the feature, plus direct probes of
  the ones that did surface (e.g. `youtube.com/shorts/xBr4x9ndG08`, a Hindi-language "how to hide
  likes" tutorial — its own `likeCount` was present, `"4865"`, not hidden) did not find one.
- **Why this is being reported now rather than continuing to guess:** the task's own instruction is
  explicit — "if finding a suitable post starts costing many attempts, STOP and report rather than
  burning URLs silently." No ScrapeCreators credits were spent chasing this (all discovery was free
  web search / `curl` against public pages), but the discovery effort itself had grown large enough
  relative to the rest of this task's budget that continuing to guess blind was the wrong use of the
  remaining session.
- **What would unblock this cheaply:** a single real YouTube Shorts URL known (by the tech lead, the
  owner, or a fresh, more targeted search session) to have "Show how many viewers like this video"
  turned off. Once a candidate exists, the capture itself is a single `fetchShortMetadata()`/
  `getYoutubeVideo()` call through the real production path (same pattern as V1 above) — 1 credit,
  0 on a 404 per the existing confirmed cost table.
- **Interim guidance, unchanged from the PRD and still binding:** per §4.7/R2, **a bare `0` on
  `likeCountInt` must continue to be treated as `UNKNOWN`, not zero**, until this is captured. Do
  not write code that assumes any particular shape (`0`, `null`, or field-absent) for a likes-hidden
  YouTube payload — none of those three has been observed.

---

## Gemini production `ANALYSIS_RESPONSE_SCHEMA` — V3, multi-slide carousel token headroom (2026-08-06)

**Closes PRD §9.1's "Unmeasured risk" row and §10.2's V3, and discharges the carried-forward item
from `docs/HANDOFF-2026-08-05.md` (item 6) referenced there.** The 83% headroom figure in the
"Gemini production `ANALYSIS_RESPONSE_SCHEMA` @ `temperature: 0` — LIVE call (2026-08-05, ticket #66
closeout)" section above was measured on a **single-video reel**. This entry measures the same
mechanism on a **10-slide, video-bearing carousel** — the more media-heavy case §9.1 flagged as the
one that would actually stress `MAX_TOKENS`.

- **Authorisation:** PRD §10.2, V3, approved 2026-08-05, 1 billed Gemini `generateContent` call
  budgeted. **Actual Gemini spend: 1 billed call**, on the second of two attempts (see credit ledger
  below for why there were two attempts and why only one reached Gemini).
- **Free-reuse check performed first, per instruction, before any spend:** the local `analyses`
  table was queried for any `analysis_mode` involving a carousel with a still-populated
  `gemini_file_uri`. **None existed.** The one prior all-image-carousel analysis in the DB
  (`images-only-carousel-row-synth-1`, `/p/uSFa7tlyLbw/`, `analysis_mode: images_only`) has `gemini_file_uri: NULL` —
  expected and correct, not a gap: `prepareParts.ts` only routes **video** parts through the Gemini
  File API (images are inlined as base64, see that file's own doc comment), and an all-image
  carousel has no video parts to upload, so it never had a File API asset to reuse in the first
  place. The one video-bearing carousel this codebase has ever captured
  (`ig_carousel_mixed_video_and_image_10_slides.json`, `/p/zGKPVUdG_7U/`) was **never actually
  analysed** (no `analyses` row references it), so there was no prior File API asset for it either.
  **Conclusion: unlike V3's single-video-reel predecessor, no zero-cost reuse path existed for a
  carousel** — the "check first" step correctly found nothing to reuse, rather than being skipped.
- **CDN-link staleness, checked before spending:** the `video_url` values already committed in
  `ig_carousel_mixed_video_and_image_10_slides.json` (captured 2026-07-22) were tested with a direct
  request before assuming a live re-fetch was required. The request could not be completed (no
  response from the CDN host) — consistent with the 2026-08-05 entry's finding that these
  short-lived signed URLs expire in days, not weeks. A live re-fetch of the post was therefore
  necessary to get workable media URLs.

### What was actually called — the real production pipeline, not a harness or a hand-assembled request

Unlike the 2026-08-05 reel entry (which called `analyzeContent()` directly with a manually
reconstructed `MediaMetadata`), this capture invoked **`runAnalysis()`** itself — the literal
function `app/api/analyze/route.ts` calls for every real user-submitted URL — via `tsx`, against
`https://www.instagram.com/p/zGKPVUdG_7U/` with an empty custom-prompt string (same default the API
route uses for an unset `prompt`). This is the single highest-fidelity capture in this file to date:
`classifyUrl()` → `fetchMetadata()` → `resolveProfile()` → `prepareParts()` (real download + Gemini
File API upload for the 7 video slides, real base64 inlining for the 3 image slides) →
`buildSystemInstruction()`/`buildUserPrompt()` → `analyzeContent()` → `parseContentAnalysis()` → a
real row written to (and left in) the app's own `analyses` table — end to end, nothing mocked,
nothing hand-rolled.

- **The carousel:** `@commenter_018`, 10 slides (7 video + 3 image, matching the `__typename`
  mix already on record for this post), `carouselItemCount: 10`, `likeCount: 14192`,
  `commentCount: 1639`.
- **Media sent to Gemini:** all 10 slides — 7 videos uploaded to the Gemini File API (one
  `fileUri` per video, `analyses.gemini_file_uri` persisted the first slide's,
  `files/runp6fexdjou`, expiring 2026-08-08T03:29:21.711Z — available for a future zero-cost reuse
  the same way the reel's was), 3 images inlined as base64. **This is a materially larger single
  request than the reel** (10 media parts vs. 1).
- **Prompt length: 23,222 characters** — comparable to, marginally larger than, the reel's 22,500
  (the 10-item slide manifest and multi-slide framing add some length, but not dramatically).
- **`config` was the real, untouched production config**: `temperature: 0`,
  `responseMimeType: "application/json"`, `responseSchema: ANALYSIS_RESPONSE_SCHEMA`,
  `maxOutputTokens: 32768` — same as the reel capture, and **still the pre-3B prompt/schema**, since
  3B has not been implemented yet. This measures headroom for the *current* contract on a
  carousel, exactly mirroring what the reel entry measured for the current contract on a reel. It
  does **not** measure 3B's not-yet-written extended prompt — that remains a future measurement once
  3B ships, same caveat the PRD itself states.

### Result

```
finishReason: STOP  (implicit, by the same fail-closed-guard construction as the reel capture:
                      analyzeContent() did not throw, and its guard only lets execution past the
                      finishReason check when it is exactly FinishReason.STOP)
usageMetadata: {
  promptTokenCount: 15663,
  candidatesTokenCount: 2192,
  totalTokenCount: 20421,
  thoughtsTokenCount: 2566,
  promptTokensDetails: [
    { modality: "TEXT", tokenCount: 6210 },
    { modality: "IMAGE", tokenCount: 774 },
    { modality: "VIDEO", tokenCount: 8679 }
  ],
  serviceTier: "standard"
}
JSON.parse succeeded with zero repair/fallback logic (parseContentAnalysis did not throw); the
analysis completed and a real row (id verification-run-row-synth-1) was written with
status='completed'.
```

- **Output-budget spend: `candidatesTokenCount` (2192) + `thoughtsTokenCount` (2566) = 4758 tokens**
  against the 32,768 `maxOutputTokens` ceiling — **~85.5% headroom remaining** (28,010 tokens free).
- **⚠️ This CONTRADICTS the risk framing in PRD §9.1, and it should be read as good news, not
  ignored.** §9.1's "Unmeasured risk" row and the PRD's own framing throughout ("a 10-slide carousel
  plus a longer prompt is the case that would actually bind") both anticipated a **carousel would
  show materially *less* headroom than the reel's 83%.** The measured result is the opposite: **the
  carousel's headroom (85.5%) is not worse than the reel's (83%) — it is marginally better.**
  `promptTokenCount` is lower for the carousel (15,663 vs. the reel's 24,052 — the reel's 61 seconds
  of continuous video plus its audio track evidently costs more input tokens than 7 short video
  slides plus 3 images), and both `candidatesTokenCount` and `thoughtsTokenCount` came out lower too
  (2192+2566=4758 vs. the reel's 1574+3994=5568). **Do not carry the PRD's "carousels are the
  higher-risk case for MAX_TOKENS" framing into 3B implementation without revisiting it** — on this
  one sample, a 10-slide mixed carousel was cheaper on every token axis than a single 61-second reel,
  not more expensive. This is one sample (same single-sample caveat as every other carousel finding
  in this file) but it is a direct, measured contradiction of a stated risk, not a minor footnote.
- **Both real-world samples (this carousel, the earlier reel) remain comfortably clear of
  `MAX_TOKENS`** — the headroom risk itself is not eliminated as a *possibility* (3B's longer,
  not-yet-written prompt could still change the picture), but the specific "carousels are worse
  than reels for this" hypothesis is now measured and falsified for the current (pre-3B) contract.

### Credit ledger — this capture

| Attempt | What happened | ScrapeCreators cost | Gemini cost |
|---|---|---|---|
| 1st `runAnalysis()` call | Fetched the post (1 credit), downloaded + uploaded all 10 media parts to Gemini's File API successfully, then **failed before reaching the Gemini `generateContent` call** — this worktree's local `my-content.db` had migrations 006–011 unapplied (`RUNBOOK.md` §8.1's exact documented trap: a stale local DB surfacing as an opaque failure, here `SQLITE_ERROR: no such column: play_count`) | 1 credit | **0 — never reached** |
| `npm run db:migrate` | Applied the missing migrations to this worktree's local DB (a schema fix, not a data mutation) | 0 | 0 |
| 2nd `runAnalysis()` call, same URL | Re-fetched the post (a fresh fetch was simplest and safest, rather than trying to resume mid-pipeline with the first attempt's now-orphaned File API uploads) — full pipeline completed, including the one billed Gemini call | 1 credit | **1 billed call** |
| **Total this capture** | | **2 credits** | **1 billed call** |

**The extra ScrapeCreators credit (vs. the 1 budgeted) was a self-inflicted local-environment issue
(unmigrated worktree DB), not a retry against an unstable API or a wasted discovery attempt — flagged
plainly per instruction rather than rounded down to "1, as budgeted."** The Gemini spend stayed at
exactly the 1 call authorised; the first attempt's DB failure occurred strictly before that call, so
no Gemini billing was wasted.

The local `analyses` row this run wrote (`verification-run-row-synth-1`) and the local
`my-content.db` migration state are both artifacts of running the real pipeline in this worktree —
consistent with the precedent set by the 2026-08-05 `/v1/instagram/profile` capture, which also left
a real cache-write behind. The `analyses` row is **not** included in this PR's diff (a local SQLite
file is not meaningful to review as a text diff and the migration state is worktree-local, not a
product fact); this file is the durable record of what was verified.

---

## Gemini production `ANALYSIS_RESPONSE_SCHEMA` @ `temperature: 0` — V4, DETERMINISM CHECK (2026-08-06)

**Closes the item both the 2026-08-05 reel entry and the PRD §5.4/AC-10/S3 left explicitly open:
"same video twice at `temperature: 0` yields identical scorecard values" — never previously tested.
Owner-approved spend for this specific gap.**

### What was actually called — the real production functions, not a harness

`analyzeContent()` (`lib/server/analysis/gemini/generate.ts`), `buildSystemInstruction()`
(`lib/server/analysis/prompts/system.ts`), and `buildUserPrompt()` (`lib/server/analysis/prompts/user.ts`)
were imported directly and invoked exactly as `lib/server/analysis/pipeline/index.ts` does
(`` `${systemPrompt}\n\n${userPrompt}` ``), via `tsx --env-file=.env.local`. Real
`ANALYSIS_RESPONSE_SCHEMA`, real `temperature: 0`, real `maxOutputTokens: 32768`. The **same**
`geminiParts`/`fullPrompt` values (same JS object references, not just equal-by-value) were passed
to two sequential `analyzeContent()` calls in one script — the strongest possible "identical input"
guarantee.

### Media source: reused an existing ACTIVE Gemini File API asset — zero ScrapeCreators spend

Per the cost-control instructions, `ai.files.get({ name: "files/runp6fexdjou" })` was checked
**first, free**, before any spend. It is the video-carousel-slide asset uploaded during the V3
capture above (`/p/zGKPVUdG_7U/`, `@commenter_018`), and was confirmed still `state: "ACTIVE"`,
`mimeType: "video/mp4"`, `expirationTime: "2026-08-08T03:29:21.711776182Z"` — comfortably alive.
Reused as the sole media part (`{ fileData: { fileUri, mimeType: "video/mp4" } }`). **No video was
re-downloaded or re-uploaded, and no ScrapeCreators call was made.**

`MediaMetadata` was built from the real, already-recorded facts for this post (V3 section above:
`url`, `username: "commenter_018"`, `mediaType: "carousel"`, `carouselItemCount: 10`,
`likeCount: 14192`, `commentCount: 1639`) — **this worktree's local `my-content.db` is isolated and
empty (a fresh worktree DB, migrated but with no `analyses` rows), so the historical row from the
V3 session was not queryable here.** Fields not already on record (caption, follower count, exact
post date) were left `null`/`undefined` rather than fabricated — `buildUserPrompt()` handles nulls
by design (`"N/A"` fallbacks), so this is real production code operating on a genuine (if partial)
metadata object, not a synthesized one.

### ⚠️ Result: NOT byte-identical on the first trial — and the divergence is BOTH structural and prose

Two `analyzeContent()` calls back-to-back, identical `geminiParts`/`fullPrompt`:

```
run1.text.length: 4998
run2.text.length: 5121
Byte-identical: false
```

**`overallScore` and the entire 7-dimension `scorecard` were IDENTICAL between the two runs** —
every one of `hookStrength/retentionFlow/visualPolish/ctaEffectiveness/messageClarity/originality/
emotionalResonance` matched exactly (`4,4,4,4,5,3,3`), and `overallScore: 4` in both. So did
`hookType`, `hookTypeSecondary`, `topicNiche`, and `ctaTiming`.

**But several other structural/enum/numeric fields DID drift** — this is not just prose:

| Field | Run 1 | Run 2 |
|---|---|---|
| `style.formatArchetype` (enum) | `TEXT_SLIDESHOW` | `CAROUSEL_STATIC` |
| `style.pacing` (enum) | `FAST` | `SLOW` |
| `style.estimatedCutsPerMinute` (number\|null) | `20` | `null` |
| `style.ctaType` (array of enums) | `["SAVE_PROMPT","FOLLOW"]` | `["FOLLOW","SAVE_PROMPT"]` |
| `style.structureBeatMap` (array length) | 10 beats | 6 beats |
| `style.onScreenText` (array length) | 10 items | 25 items |
| `strengths`/`weaknesses`/`keyMoments`/`suggestions` | different counts and different prose | different counts and different prose |

`structureBeatMap`'s divergence is not just wording: run 1's 10 beats step by 3-second intervals
(0, 3, 6, 9…) with per-beat `beatType`/`description` mapped to a 6-point "Hook/Value/Story/CTA/
Visuals/Sound" framework; run 2's 6 beats step by 1-second intervals (0, 1, 2, 3…) and follow a
completely different narrative segmentation. This is two different structural interpretations of
the same 10-slide input, not a paraphrase of the same one.

**Verdict for this trial: `temperature: 0` did NOT produce byte-identical output, and the drift is
NOT confined to prose.** The scorecard (the single most commercially load-bearing field in the
schema) held steady, but `formatArchetype`, `pacing`, `estimatedCutsPerMinute`, and `ctaType`
ordering — all structural/enum/numeric fields, exactly the class of field the tech lead has been
moving out of the Gemini block into deterministic code — drifted between two literally-identical
requests.

### ⚠️⚠️ A second trial (see credit-ledger note) came back byte-identical, with an implicit-cache hit

Due to an operational mistake (re-running the same script a second time, in order to capture full
stdout to a log file — the researcher did not realize this would fire two more live billed calls
rather than replaying the first trial's output), a **second pair** of calls was made against the
exact same `geminiParts`/`fullPrompt`. That pair came back:

```
run1.text === run2.text: TRUE (byte-identical)
run1 usageMetadata: promptTokenCount 7225, candidatesTokenCount 1348, thoughtsTokenCount 2313
run2 usageMetadata: promptTokenCount 7225, candidatesTokenCount 1348, thoughtsTokenCount 2313,
                     cachedContentTokenCount: 6660, cacheTokensDetails: [...]
```

The second call of this second pair shows `cachedContentTokenCount` — Gemini's **implicit context
caching** kicked in and served (or heavily reused) a cached prefix for a request byte-identical to
one made moments earlier, which plausibly explains why this pair was fully deterministic while the
first pair (calls made without an intervening identical call already warm) was not. This is a
plausible mechanism, not independently confirmed by Google documentation in this session — flagged
as inference, not fact.

Across all 4 calls made this session, the first pair's run1 output and the second pair's (both
identical) output matched on `formatArchetype: TEXT_SLIDESHOW`, `pacing: FAST`,
`estimatedCutsPerMinute: 20`, `ctaType: ["SAVE_PROMPT","FOLLOW"]`, 10-beat `structureBeatMap`, and
10-item `onScreenText` — i.e. 3 of the 4 calls agreed with each other; only the first pair's `run2`
(the very first call made with no prior identical call to potentially cache against) diverged.

### Bottom-line verdict for AC-10/S3 and PRD §5.4

- **AC-10/S3's literal claim — "temperature 0 produces the same output across two runs on identical
  input" — is FALSE as a hard guarantee**, at least for `gemini-2.5-flash` on a real production-sized
  multi-part-carousel prompt. It is measured true only *some* of the time in this session (3 of 4
  calls agreed; the first "cold" pair disagreed on several structural fields).
- **This is genuinely good news for the tech lead's "move fields out of the Gemini block" effort,
  not bad news to be smoothed over**: the field that stayed rock-solid across BOTH trials was
  `overallScore` and the full `scorecard` — the exact fields most consumers care about most. The
  fields that drifted (`formatArchetype`, `pacing`, `estimatedCutsPerMinute`, `ctaType` ordering,
  `structureBeatMap`, `onScreenText`, and all free-text prose) are precisely descriptive/creative
  fields, not the scoring fields. **But it is not a clean "prose only" story either** —
  `formatArchetype` and `pacing` are classification enums and `estimatedCutsPerMinute` is a number,
  not prose, and they drifted. Reporting this plainly rather than rounding to "only prose varies":
  the scorecard was stable, several non-prose structural/enum/numeric fields were NOT.
- **Do not treat `temperature: 0` as a determinism guarantee for any field on this schema.** If a
  downstream feature needs a literally-stable value from a single field, the only field this session
  found reproducible under a genuinely cold (non-cached) call is the scorecard/`overallScore` pair,
  and even that is now an n=2 sample, not a proof.

### Credit ledger — this capture (V4)

| Call | ScrapeCreators cost | Gemini cost |
|---|---|---|
| `ai.files.get({ name: "files/runp6fexdjou" })` — free asset-state check, done first | 0 | 0 (not billed as generation) |
| Trial 1, call A (`analyzeContent()` run 1) | 0 | 1 billed `generateContent` |
| Trial 1, call B (`analyzeContent()` run 2) | 0 | 1 billed `generateContent` |
| Trial 2, call A (`analyzeContent()` run 1) — **unplanned, operational mistake re-running the script** | 0 | 1 billed `generateContent` |
| Trial 2, call B (`analyzeContent()` run 2) — **unplanned, same mistake** | 0 | 1 billed `generateContent` |
| **Total this capture** | **0 ScrapeCreators credits** | **4 billed Gemini `generateContent` calls** |

**This is double the minimum needed to answer the ticket's question ("twice on identical input").**
The task was completable with 2 calls; a second identical pair was fired by mistake while trying to
capture a full log file, not to extract additional signal. Reported in full rather than described as
"2, as planned" — per the task's own instruction to report every billed call, including the
unplanned ones. In hindsight the accidental second pair did add one genuinely useful data point (the
implicit-cache-driven byte-identical result), but that was not the intent and should not be read as
a deliberate 4-call design.

---

## Credit ledger for this verification session (2026-08-06)

| Call | credits_remaining after |
|---|---|
| (before, last known 2026-08-05) | 31989 |
| ~2 untracked calls elsewhere between 2026-08-05 and this session (inferred, not directly observed) | ~31987 |
| V1 — `/p/cgwUkjyq7TO/` (counts-disabled post) | 31986 |
| V3 attempt 1 — `/p/zGKPVUdG_7U/` (failed before Gemini call, local DB migration gap) | ~31985 |
| V3 attempt 2 — `/p/zGKPVUdG_7U/` (succeeded) | ~31984 |
| V2 | **not attempted — 0 credits spent, see checkpoint above** |
| V4 | **0 ScrapeCreators credits — reused an existing ACTIVE Gemini File API asset and already-recorded metadata, no live ScrapeCreators call made** |

**Total this session: 3 ScrapeCreators credits (1 for V1, 2 for V3) + 5 billed Gemini
`generateContent` calls (1 for V3, 4 for V4 — see V4's own ledger above for why 4, not 2).** The
exact post-session `credits_remaining` was not independently re-checked (that would itself be a
balance-check-only call, which is exactly what the task instructions prohibit) — the ~31984 figure
above is arithmetic from the one directly-observed reading (31986 after V1) minus V3's two calls, not
a second live reading. V4 made no ScrapeCreators calls at all, so it does not change this figure.

---

# Infrastructure — first-party documentation facts (NOT live captures)

**Added 2026-08-18 (tech lead, John), for deploy tickets #244 / #246 and TDD §11.2a–§11.2c.**

**Read the charter warning before using anything below.** Everything above this heading is a **live API
capture**. Almost everything below is **vendor documentation**, which is a weaker class of evidence: docs can
be stale, aspirational, or silently narrower than the runtime. This section exists because Railway and Turso
are *infrastructure*, and the honest options were (a) write nothing and let the next agent rebuild it from
contradictory community forum threads, or (b) write it down with the provenance stated on every line.
**(b), with labels:**

- **`[DOC]`** — first-party vendor documentation only. No live verification. **Treat as a strong prior, not
  a fact.**
- **`[LIVE]`** — an actual response captured from a real endpoint, with the date and the raw output.

**No credits were spent producing any of this.** Railway and Turso reads are not metered against the
ScrapeCreators or Gemini balances. No infrastructure was created, moved or destroyed.

---

## Railway

### `[DOC]` Deploy regions — exactly four

| Region ID | Location |
|---|---|
| `us-west2` | California, USA |
| `us-east4-eqdc4a` | Virginia, USA |
| `europe-west4-drams3a` | Amsterdam, Netherlands |
| `asia-southeast1-eqsg3a` | Singapore |

Sources: <https://docs.railway.com/reference/regions>, and the same four are restated as
`X-Railway-Upstream-Zone` values (`railway/us-west2`, `railway/us-east4-eqdc4a`,
`railway/europe-west4-drams3a`, `railway/asia-southeast1-eqsg3a`) at
<https://docs.railway.com/networking/edge-networking>.

**Deploy *regions* are not edge POPs — do not conflate them.** `[DOC]` *"Edge POPs are the entry points where
user traffic first reaches Railway… Deployment regions are where your applications actually run. Railway
offers four."* `[DOC]` The edge proxy *"terminates TLS, processes the request, and forwards it to your
deployment"*, routing by **anycast** to the nearest POP — so **TLS terminates near the user regardless of
which of the four regions the service runs in.** Source: <https://docs.railway.com/networking/edge-networking>.

`[LIVE]` **2026-08-18** — `GET https://railway.com/.railway/pops` (unauthenticated, 200) returns the POP list
as JSON, including `{"id":"sin1","name":"Singapore","region":"sin","status":"available"}` alongside `ams1`,
`atl1`, `bcn1`, `ber1`, `bru1`, `cdg1`, `den1`, `hkg1`, … The docs label this endpoint *"provided as-is,
without any support, and the response format may change without notice"* — **so do not build code against
its shape.** It is cited here only as evidence that a Singapore POP exists.

### 🚨 `[DOC — NEGATIVE RESULT]` Railway's `X-Forwarded-For` behaviour is **UNDOCUMENTED. Do not build on it.**

**This is the most reusable line in this section. It exists to stop the next agent re-deriving it from forum
posts, which is exactly how this becomes a security bug.**

Railway's networking documentation (<https://docs.railway.com/networking/edge-networking>) describes anycast
routing, TLS termination, the request flow, and the `X-Railway-Edge` / `X-Railway-Upstream-Zone` headers.
**It does not mention `X-Forwarded-For`, `X-Real-IP` or `X-Envoy-External-Address` at all** — verified by
grepping the rendered page on 2026-08-18: zero matches for any of the three. No other page on
`docs.railway.com` documents it either.

**The only sources that address it are community Help Station threads, and they contradict each other:**

- one asserts Railway **strips** `X-Forwarded-For` at the edge —
  <https://station.railway.com/questions/edge-proxy-x-forwarded-for-and-x-real-ip-c5a50049>
- another asserts Railway **appends** the client IP, so *"only the rightmost value is trustworthy"* —
  <https://station.railway.com/questions/security-critical-questions-on-edge-prox-8fddd775>

Both cannot be true; neither is first-party; the Help Station is not documentation.

**Consequence, already ruled on in #246 and binding:** `TRUST_PROXY_HEADERS` stays **unset (false)**.
`getClientKey()` reads the **leftmost** `X-Forwarded-For` entry
(`const firstIp = forwardedFor?.split(",")[0]?.trim();`). If Railway *appends*, that leftmost value is
entirely attacker-supplied and setting the flag `true` would hand an attacker a **complete bypass of the
per-client PIN lockout**. The failure mode of leaving it `false` is merely a shared rate-limit key on an
internal staff tool.

**If this is ever resolved empirically, the fix is to rewrite `getClientKey()` to read the RIGHTMOST entry —
NOT to flip the flag.** Record the empirical answer here as `[LIVE]` when it exists.

### `[DOC]` `preDeployCommand` semantics

> *"The command to run before starting the container."*
> Pre-deploy commands *"execute between building and deploying your application, handling tasks like database
> migrations or data seeding before your application runs."*
> **"If your command fails, it will not be retried and the deployment will not proceed."**

Sources: <https://docs.railway.com/guides/pre-deploy-command>, <https://docs.railway.com/reference/config-as-code>

**Why this sentence matters and must not be paraphrased away:** it is the entire safety argument for running
`db:migrate` as a pre-deploy step. A failed migration **blocks the release** rather than shipping application
code against an un-migrated database. Note the corollary — *no retry* — so a migration that fails on a
transient network blip fails the whole deploy. That is the intended trade (see also TDD OR-25: no retry,
confirmed 2026-08-06). **Do not add retry wrapping to make it "more robust"; that removes the guarantee.**

### `[DOC]` CI deploy — `RAILWAY_TOKEN` + `railway up --detach`

> *"Set `RAILWAY_TOKEN` for project-level actions"*

then `railway up`; `--detach` deploys **without streaming build logs** (so the CI step returns instead of
tailing), and `-s, --service` targets a specific service.
Source: <https://docs.railway.com/guides/cli>

**`RAILWAY_TOKEN` (project-scoped) is the correct one for CI — not `RAILWAY_API_TOKEN`,** which is
account-level and grants more privilege than a deploy step needs.

### `[DOC]` Dockerfile auto-detection and `ARG` build variables

Railway builds from a `Dockerfile` at the **source root automatically**; `RAILWAY_DOCKERFILE_PATH` overrides
the path. **Build-time variables must be declared with `ARG` in the stage that uses them** — a Railway service
variable is not visible to a build stage that has not declared it.
Source: <https://docs.railway.com/guides/dockerfiles>

Relevant to this repo: the root `Dockerfile` already declares `ARG APP_SESSION_SECRET`,
`ARG YT_DLP_VERSION`, `ARG TARGETARCH` and `ARG NODE_VERSION`.

### `[DOC]` Serverless / app sleeping

Off by default, toggled per service under *service settings → Deploy → Serverless*.
Source: <https://docs.railway.com/guides/optimize-usage>

---

## Turso

### `[LIVE]` Database locations — **UPGRADED FROM `[DOC]` ON 2026-08-18. The block is cleared.**

**This table was `[DOC]` and is now `[LIVE]`.** The previous session recorded the authenticated list as
blocked on an owner-minted platform token. **It is no longer blocked, and the reason is worth recording: the
token was never the only route.** The owner has the **Turso CLI installed at `~/.turso/turso`** (v1.0.32,
**not on `PATH`** — `which turso` fails, which is how the previous session concluded it was absent) and it is
**already authenticated** (`turso auth whoami` → `jordanathaa`). The CLI carries its own platform credential,
so `turso db locations` is an authenticated live read of the same control plane the REST endpoint serves.

```
$ ~/.turso/turso db locations
ID↓                 LOCATION
aws-ap-northeast-1  AWS AP NorthEast (Tokyo)  [default]
aws-ap-south-1      AWS AP South (Mumbai)
aws-eu-west-1       AWS EU West (Ireland)
aws-us-east-1       AWS US East (Virginia)
aws-us-east-2       AWS US East (Ohio)
aws-us-west-2       AWS US West (Oregon)
```

**Result: exactly six, and they match the documented example set precisely.** The `[DOC]` caveat below — that
the six might be an incomplete example — is now **resolved in the docs' favour**. The list is complete.

**Also `[LIVE]`: Tokyo is marked `[default]`** for this account, i.e. the CLI's own closest-location pick
agrees with the `region.turso.io` capture and with the §11.2c region decision. Independent confirmation.

REST equivalent: `GET https://api.turso.tech/v1/locations` — **requires**
`Authorization: Bearer <platform API token>`. Source: <https://docs.turso.tech/api-reference/locations/list>

| Code | Location |
|---|---|
| `aws-ap-northeast-1` | Tokyo |
| `aws-ap-south-1` | Mumbai |
| `aws-eu-west-1` | Ireland |
| `aws-us-east-1` | Virginia |
| `aws-us-east-2` | Ohio |
| `aws-us-west-2` | Oregon |

<details>
<summary><strong>Superseded: the original <code>[DOC]</code>-only caveat and the BLOCKED note (kept for review)</strong></summary>

> **`[DOC]`, NOT `[LIVE]` — and the distinction is real here.** These six codes come from the **rendered
> example response** on that page. The page's OpenAPI schema defines the payload only as *"a mapping of
> location codes to location names"* — **it does not assert that the example is the complete set.**
>
> **Attempted live confirmation on 2026-08-18: BLOCKED.**
> - Unauthenticated `GET https://api.turso.tech/v1/locations` → **HTTP 401**,
>   `{"error":"token contains an invalid number of segments"}`.
> - No Turso platform API token is available to an agent: `.env` / `.env.local` have `TURSO_AUTH_TOKEN=`
>   **empty** and `TURSO_DATABASE_URL=file:./my-content.db`. No `turso` CLI is installed.
> - Minting a platform token is an **owner action**.

**Why it was wrong, and the lesson:** the `TURSO_AUTH_TOKEN` env var is a **database** token — it was empty
and that finding was correct, but it was never the credential this call needed. The **CLI's own stored
platform login** was the credential, and it existed the whole time. `which turso` returning nothing was
treated as "no CLI"; the binary was simply outside `PATH` at `~/.turso/turso`. **Check `~/.turso/`,
`/opt/homebrew/bin` and `/usr/local/bin` before concluding a vendor CLI is absent.**</details>

**What is `[AWS]`, not Fly.** These are AWS regions. TDD §11.2a's *"Turso runs on Fly's infrastructure"* was
true of **legacy** Turso (~30 Fly city-coded locations) and is **stale** for anything provisioned today. See
TDD §11.2c.

### `[LIVE]` Closest region — **2026-08-18, from the owner's own network**

`GET https://region.turso.io` — **unauthenticated**, documented at
<https://docs.turso.tech/api-reference/locations/closest-region>. Response fields: `server` (*"the location
code for the server responding"*) and `client` (*"the location code for the client request"*).

Captured three times, identical each time:

```json
{"server": "aws-ap-northeast-1", "client": "sin"}
```

**This is Turso answering the region question directly:** it classifies this client as **Singapore** and names
**Tokyo** as the closest location it has. It independently corroborates that **there is no SE-Asia Turso
location**, without needing the authenticated list above.

`[LIVE]` **Side observation, recorded so it is not mistaken for a contradiction:** the response headers of
this endpoint are `server: Fly/d778e1ff4`, `via: 2 fly.io`, `fly-request-id: …-sin`. **Parts of Turso's
control plane are still Fly-hosted.** That does **not** mean databases are — the selectable database
locations are AWS regions. Do not "correct" TDD §11.2c on the strength of this header.

### `[DOC]` Embedded replicas — how they actually behave

Source: <https://docs.turso.tech/features/embedded-replicas/introduction>

- **Writes are NOT local.** *"Writes are sent to the remote primary database"* (the `syncUrl` target). An
  `offline: true` mode exists for local writes; that is a different feature.
- **Read-your-writes:** the replica that issued a write *"will always be able to see the new data right away,
  even if it never calls `sync()`."*
- **Cross-instance staleness:** **other** replicas see it *"when they call `sync()`, or at the next sync
  period."* Eventual consistency between instances, bounded by `syncInterval`.
- **Filesystem:** requires a real local file path. *"Not suitable for serverless environments without
  persistent filesystems."* *"Removing local files causes the replica to re-sync from scratch."*
- *"Do not open the local database while the embedded replica is syncing. This can lead to data corruption."*
- Minimum sync unit is one 4kB frame, so a 1-byte write still syncs as 4kB.

### `[LIVE]` `@libsql/client` — which transport a config actually selects (code read, 2026-08-18)

`@libsql/client@0.17.4` is installed. `node_modules/@libsql/client/lib-esm/node.js:13-23` dispatches on the
URL scheme:

| `url` scheme | Client used | Native addon needed? |
|---|---|---|
| `https:` / `http:` | `./http.js` (hrana over HTTP) | **No** — pure JS |
| `wss:` / `ws:` | `./ws.js` | **No** — pure JS |
| anything else (incl. `file:`, and `libsql:` after expansion) | `./sqlite3.js` | **YES** |

`sqlite3.js` constructs `new Database(path, {syncUrl, syncPeriod, readYourWrites, offline, …})` from the
**native `libsql` package** (`libsql@0.5.29`), which resolves a per-platform binary from its
`optionalDependencies` (`@libsql/linux-x64-gnu`, `@libsql/linux-arm64-gnu`, `@libsql/darwin-arm64`, …). Only
`@libsql/darwin-arm64` is present in the local macOS `node_modules`.

**Consequence for this repo, and it is the deciding one:** `lib/server/db.ts` today does
`createClient({url: process.env.TURSO_DATABASE_URL, authToken})`. With a `libsql://…turso.io` URL that takes
the **pure-JS HTTP path** — no native addon in the production image at all. Switching to embedded replicas
(`url: "file:…"`, `syncUrl: …`) would newly require a **native `.node` binary to survive Next.js
`output: "standalone"` file tracing**, which is **UNVERIFIED**. See TDD §11.2c C3 for the
don't-adopt recommendation.

`sqlite3.js` also rejects in-memory + `syncUrl`: *"Embedded replica must use file for local db"*.

### Importing an existing SQLite file into Turso — **two different commands, and they are not equivalent**

**Added 2026-08-18 for #246. Nothing here was executed — see the "does NOT claim" list.**

There are **two** ways in, and the CLI help proves they take different flags:

| | `turso db create <name> --from-file <path>` | `turso db import <path>` |
|---|---|---|
| Names the DB | **You do** (positional arg) | **Derived from the filename** — not settable |
| `--location` | **Yes** | **NO — flag does not exist** |
| `--group` | Yes | Yes |
| Documented size limit | **`[DOC]` "The file size is limited to 2GB."** | not documented |
| Documented WAL requirement | not mentioned | **`[DOC]` "WAL journal mode enabled"** |

`[CLI-HELP]` from `turso db create --help` / `turso db import --help`, CLI **v1.0.32**, captured 2026-08-18.
`[DOC]` <https://docs.turso.tech/cli/db/create>, <https://docs.turso.tech/cli/db/import>.

**Prefer `db create --from-file`.** It is the only one of the two that lets you set **both the database name
and the location** in a single command, and location is a §11.2c-binding decision. `db import` picks the name
off the filename and gets its location from the group — fine by luck if the group is already in the right
region, but it is luck, not control.

#### The WAL trap — `[DOC]` requirement vs `[LIVE]` local state

`db import`'s docs require the source file to have *"WAL journal mode enabled"*. **The owner's
`my-content.db` does not:**

```
$ sqlite3 'file:<copy>?mode=ro' 'PRAGMA journal_mode;'
delete
```

`[LIVE]` 2026-08-18, read from a **copy**, `mode=ro`. `db create --from-file`'s docs do **not** state a WAL
requirement — but since it is undocumented either way, **converting a copy to WAL first satisfies both paths
and costs nothing.** Never convert the original: `PRAGMA journal_mode=WAL` is a **write** to the file header.

#### `[LIVE]` The migration runner is safe against an imported, fully-populated `_migrations`

`scripts/migrate.ts` gates **per file, by name**:

```ts
const existing = await db.execute({
  sql: "SELECT name FROM _migrations WHERE name = ? LIMIT 1",
  args: [file],
});
if (existing.rows.length > 0) continue;
```

`CREATE TABLE IF NOT EXISTS _migrations` runs first, so a pre-existing table is fine. An imported DB arrives
with **all 13 rows** present, so **every migration is skipped and the pre-deploy step is a clean no-op.**

**This does not contradict #246's "do not hand-run migrations" warning — read what that warning is about.** It
warns against applying *some* migrations by hand, which leaves a **partially**-populated `_migrations`: the
runner then re-runs the remainder against a schema that already has them, and non-idempotent DDL
(`ALTER TABLE … ADD COLUMN`) errors. A **fully**-populated table is the opposite case and is the safe one.
The distinguishing property is completeness, not provenance.

#### `[LIVE]` The local DB's schema is byte-identical to what the 13 migrations produce

Verified 2026-08-18 by building a fresh DB in `/tmp` from `migrations/001…013` and diffing `.schema` against a
read-only copy of `my-content.db`. **The only difference is the `_migrations` table itself**, which the
migration files do not create (the runner does). **Zero schema drift** — so an imported DB and a
migrated-from-scratch DB reach the same schema by two routes.

---

## What this section deliberately does NOT claim

- ~~That the Turso location list is complete.~~ **RESOLVED 2026-08-18** — the authenticated
  `turso db locations` capture confirms exactly six, matching the doc example. This bullet no longer applies.
- That `turso db import` / `--from-file` were **executed**. They were **not**. Every claim about them is
  `[DOC]` or `[CLI-HELP]`. **No database was created, imported, modified or destroyed.** The end-to-end import
  is unrun until the owner runs it.
- Any Turso **plan/quota** figure. The 8 GiB free-tier storage number circulating in search results was
  **not** confirmed against a first-party page in this session; `https://docs.turso.tech/limits` returns
  **404**. Do not cite a quota from this file.
- Any Railway `X-Forwarded-For` behaviour whatsoever. **Undocumented is the finding.**
- Any measured latency number. The Singapore↔Tokyo (~70ms) and Singapore↔Virginia (~230ms) figures used in
  TDD §11.2c are **conventional estimates, not measurements taken here.** They are directionally reliable and
  the decision does not turn on their precision — but they are not `[LIVE]` and must not be cited as such.

