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
| `ig_carousel_all_images_10_slides.json` | `/p/DVtNQtmCQnO/` | `XDTGraphSidecar` | 10 children, **ALL `XDTGraphImage`** |
| `ig_reel_1_zero_view_count.json` | `/reel/Da4TFq_pKvM/` | `XDTGraphVideo` | `video_view_count: 0` but `video_play_count: 116333` |
| `ig_reel_2.json` | `/reel/DEC1qiWsmYm/` | `XDTGraphVideo` | `video_view_count: 305044`, `has_audio: true` |
| `ig_reel_3.json` | `/reel/DWgcxq2CaCZ/` | `XDTGraphVideo` | `video_view_count: 150780` |
| `ig_single_image_post.json` | `/p/Da7oY2ep3Qr/` | `XDTGraphImage` | **single image, NOT a carousel** — no `edge_sidecar_to_children` |

All five posts belong to the same creator (`@giorrando`).

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
id: string                  // e.g. "POLARIS_3849791073308725783" — POLARIS_-prefixed
shortcode: string           // per-slide shortcode, e.g. "DVtNJWICVIX"
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
| 1 | `/p/DVtNQtmCQnO/` | 31999 |
| 2 | `/reel/Da4TFq_pKvM/` | 31998 |
| 3 | `/reel/DEC1qiWsmYm/` | 31997 |
| 4 | `/reel/DWgcxq2CaCZ/` | 31996 |
| 5 | `/p/Da7oY2ep3Qr/` | 31995 |

**Total spend: 5 credits** — 1 per call, `trim=false`, all HTTP 200, no
retries, no exploratory calls.

---

## ScrapeCreators — `/v1/instagram/post` — VIDEO-BEARING CAROUSEL CAPTURED (2026-07-22, follow-up)

- **Authorisation:** one-time owner-approved live capture, exactly 1 URL, 1 credit. This is a
  follow-up to the 5-fixture session above — it closes the gap that session explicitly left open.
- **Tested URL:** `https://www.instagram.com/p/DZCPPJTjKVy/` (`utm_source`/`igsh` stripped before
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
id: string                    // e.g. "3909753692152934905" — PLAIN NUMERIC,
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
| `/p/DZCPPJTjKVy/` (the video-bearing carousel) | 31995 | 31994 |

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
