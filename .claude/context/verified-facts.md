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
