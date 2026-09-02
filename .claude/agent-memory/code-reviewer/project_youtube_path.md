---
name: youtube-path
description: The YouTube Shorts path is functionally broken in production — yt-dlp is bot-blocked from Railway, so every Short is analysed caption-only and Gemini fabricates the visual analysis
metadata:
  type: project
---

**Established 2026-08-21 by live audit track B3 against deployment `a42a6d59` (= `f929fb4`), with three
owner-supplied Shorts. Findings live in `/tmp/AUDIT-TRACK-B3-youtube.md` (untracked, may be gone).**

`extractVideoUrl()` in `lib/server/analysis/fetcher/youtube.ts` shells out to `yt-dlp`, which YouTube
answers from the Railway IP with `ERROR: [youtube] <id>: Sign in to confirm you're not a bot.` The error
is caught, logged, and `null` returned. The pipeline then builds an empty `mediaParts`, so **every**
YouTube analysis is written `analysis_mode='metadata_only'`, `video_url=NULL` — and Gemini, which was
sent only the caption, returns timestamped visual claims ("0:10 — analogi biji", "talking head vs b-roll",
"vary facial expressions") that it cannot have observed. 3 of 3 Shorts reproduced this.

**Why it matters:** the fabrication is indistinguishable from a real video analysis except for a small
`Caption only` chip in the table; the prompt has no "no media was attached" branch. Each fake costs a
ScrapeCreators credit plus a Gemini call.

**How to apply:** never treat a YouTube row's Gemini prose as evidence of anything visual — check
`analysis_mode` first. Before reviewing or re-testing anything on the YouTube path, re-check whether the
yt-dlp block has been fixed (cookies / egress proxy); if it hasn't, the path is still producing fabricated
rows and spending credits to do it. **Do not spend credits re-proving this.**

**`metadata_only` is the pipeline's DEFAULT, not an Instagram carousel marker.** `analysisMode` starts
as `metadata_only` and is only upgraded (`full_video` / `images_only`) when `mediaParts.length > 0`. An
all-image IG carousel is `images_only`; an IG row stored `metadata_only` means *no media reached Gemini*
— the same fabrication case as YouTube. PR #297 shipped a code comment and a test name asserting the
opposite ("Instagram's metadata_only means a genuinely all-image carousel"); both were flagged blocking.
Do not accept that framing if it reappears.

Two settled sub-facts worth not re-deriving:
- **Shorts-only is deliberate** (#54/#58) — the classifier regex must not be widened; `cleanYouTubeUrl`
  strips the query string and would destroy a `watch?v=` id.
- **YouTube thumbnails deliberately bypass `/api/image-proxy`** (`toProxiedThumbnail` returns
  non-Instagram URLs unchanged; the proxy allowlist is IG/FB-CDN only). A brief once claimed otherwise.
- On a missing `subscriberCount` YouTube **writes no `profiles` row at all** (throw -> `cached ?? null`),
  so it can never land a null follower count the way Instagram's `?? null` can. The cost is that the
  channel is re-fetched and re-fails on every subsequent analysis. Instagram's side is the weaker design.

**Pending replacement (as of 2026-08-24, PR #299 / ticket #295, branch `be/295-youtube-gemini-native`,
NOT merged):** yt-dlp is dropped entirely and the public YouTube URL is handed to Gemini as a bare
`{ fileData: { fileUri } }` part (no `mimeType`) so Google fetches the video server-side. Two consequences
to carry forward if it merges — verify against the code first, this was reviewed pre-merge:
- **#292's credit ordering does not survive.** The free local probe is gone, so a Short Gemini cannot
  obtain now costs 1 ScrapeCreators credit (video) + possibly a 2nd (channel, on profile-resolve cache
  miss) + a Gemini title call. The *refusal* does survive (delete on first analysis, `status='failed'` on
  re-analysis) — mutation-proved.
- **The fabrication risk inverts rather than disappearing.** `analysis_mode` is set to `full_video`
  unconditionally before the Gemini call, so a row can now claim a full video analysis with no evidence
  the video was ingested. The only mechanical proof is a `"modality":"VIDEO"` entry in
  `usageMetadata.promptTokensDetails`, which the code logs but never checks.

Related: [[verify-the-brief]], [[production-deploy-drift]], [[owner-preferences]].
