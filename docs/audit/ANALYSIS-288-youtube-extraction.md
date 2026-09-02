# ANALYSIS-288 — YouTube video extraction fails silently, producing fabricated analyses

- **Issue:** #288
- **Author:** John (tech lead)
- **First drafted:** 2026-08-23 — **updated 2026-08-24** with owner rulings and the spike result.
- **Status:** analysis complete, owner has ruled, tickets filed (#292, #293, #294, #295).
- **Tracked?** No. Deliberately untracked / uncommitted.

## 1. What actually goes wrong

`fetchYoutubeMetadata` (`lib/server/analysis/fetcher/router.ts:41-45`) runs two independent
fetches in this order:

1. `fetchShortMetadata(url)` — ScrapeCreators `/v1/youtube/video`. **Costs 1 credit.**
2. `extractVideoUrl(url)` — `yt-dlp`, resolves a playable stream URL. Costs nothing.

When YouTube blocks step 2, `extractVideoUrl` swallows the error and returns `null`, so
`metadata.videoUrl` is `null`.

Downstream, `pipeline/index.ts:167-186` builds `mediaParts` from `metadata.mediaParts` or,
failing that, a synthetic single video part built from `metadata.videoUrl`. With
`videoUrl === null` that fallback yields `[]`. The media block is skipped and `geminiParts`
stays `[]` — but **line 347 calls `analyzeContent(geminiParts, fullPrompt)` regardless**.

Gemini is asked for a full visual analysis with zero media parts and only a text prompt
containing title, description and stats. It complies. The row saves as
`analysis_mode = 'metadata_only'` and is otherwise indistinguishable from a real video
analysis. The user is charged and shown invented visual claims.

### The line where the bug was decided

`router.ts:35-40`: "A failed `extractVideoUrl` yields `videoUrl: null`, which the pipeline
treats as a **legitimate** metadata-only analysis."

That word is the whole defect. It is true for Instagram — an all-image post genuinely has no
video. It is false for YouTube: a Short is always a video, so `videoUrl === null` can only
mean extraction failed. The comment generalised an Instagram-shaped rule onto a platform
where it does not hold, and the code followed the comment.

## 2. Owner rulings (2026-08-24)

**(b) REFUSE, not label.** Create no row, charge nothing, tell the user honestly. Labelling
was rejected: a labelled-but-fabricated analysis is still fabricated, users do not read
badges, and the product's value claim is that it looked at the video. Bundled with it: the
credit-order reorder, so a blocked Short costs 0 credits instead of 1.

**(2) Run the option-3 spike.** Done — see §3.

## 3. Spike result: option 3 WORKS

Contract recorded in `.claude/context/verified-facts.md`, section "Gemini — YouTube URL as
direct video input (`fileData.fileUri`) — LIVE (2026-08-24, issue #288 spike)".

- **Working shape on `@google/genai@2.13.0`:** `{ fileData: { fileUri: "<url>" } }`,
  `mimeType` omitted.
- **The `{type:"video", uri}` docs form does NOT exist on our SDK** — that page describes a
  newer unified surface. Our `Part` has no `type`/`uri` member.
- **`youtube.com/shorts/<id>` accepted directly**; no `watch?v=` rewrite, so
  `cleanYouTubeUrl()` (which blanks the query string) must not be used here.
- **Proof of real vision:** `usageMetadata.promptTokensDetails` contained `"modality":
  "VIDEO"` (6049 tokens) and `"AUDIO"` (31). Plus a designed fabrication test — clip titled
  "Shortest Video on Youtube" with no visual metadata, yet the model correctly reported a
  ginger-and-white cat mid-meow on beige tile with a Greek-key rug border. Ground truth from
  the free public thumbnail.
- **Trap:** with no `videoMetadata`, a 1 s clip returned HTTP 400 "No frames to extract".
  Not an access failure — default sampling is 1.0 fps. `videoMetadata: { fps: 24 }` fixed it.
- **Limits:** preview feature, public videos only, free tier 8 h/day, ≈300 tok/sec input
  (≈18k for a 60 s Short), ≈100 tok/sec at low resolution. Raising `fps` multiplies cost.

**Cost:** 2 Gemini calls, 0 ScrapeCreators credits.

### What this unlocks

The YouTube path can drop `yt-dlp`, the `/tmp` download, the File API upload and temp
cleanup — removing the blocked-egress failure mode at its root. **Instagram's `prepareParts`
is unaffected**: Instagram serves CDN URLs we can fetch, and Gemini has no equivalent
"fetch this Instagram URL" capability. The refusal work still ships regardless — it is
correct whenever media genuinely cannot be obtained, and it is the safety net if the preview
feature is withdrawn.

## 4. Existing damage

Three rows: `9af82317`, `b337e51e`, `bee4c1b7`. Standing rulings re-confirmed: no migration,
no backfill, no recompute, no deletion. Remedy is a visible untrusted banner on those rows.

### Trap for whoever builds the banner

The `analysisMode` reaching the UI is **not** the stored `analyses.analysis_mode` column. It
is derived at read time from the Tier-2 performance bucket key —
`deriveAnalysisMode(computed.tier2)` in `lib/api/analyses/helpers.ts` (def `:508`, call
`:545`). Fine for a cosmetic label; not fine for a correctness banner. A banner saying "this
may be fabricated" must be driven by the fact recorded when the row was written. Read the
stored column directly.

## 5. Why no new failure path is needed

`pipeline/index.ts:393-406` already reports `"error"`, deletes the row for a first-time
analysis or sets `status = 'failed'` for a re-analysis, and rethrows; `finally` cleans temp
files. (b1) only needs to **throw**. Nobody should add a bespoke failure branch.

## 6. Tickets filed

| Ticket | Scope | Depends on |
|---|---|---|
| #292 | [BE] Refuse before spending a credit | none |
| #293 | [BE] Prompt guard, zero media parts | none — parallel |
| #294 | [FE+BE] Untrusted banner, 3 rows | none — parallel |
| #295 | [BE] Gemini native URL input, drop yt-dlp | after #292 |

## 7. Premises checked this run

- OK: `router.ts:41-45` order; pipeline empty-parts path, unconditional `analyzeContent` at
  L347, and `:393-406` failure plumbing; `cleanYouTubeUrl` blanks `parsed.search`; model
  `gemini-2.5-flash`; SDK `@google/genai@2.13.0`.
- **Corrected:** `deriveAnalysisMode` is in `lib/api/analyses/helpers.ts`, not under `app/`.
- **Corrected in #288's body:** the content-cell constants path is
  `app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell/constants.ts:19`.
- **Unverified:** the three row ids could not be re-confirmed locally — commit `75f41e8`
  scrubbed production creator data from `my-content.db`. Carried forward from the original report.
