import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { classifyUrl } from "@/lib/server/analysis/classifier";
import { fetchMetadata } from "@/lib/server/analysis/fetcher";
import { deleteTempFile } from "@/lib/server/analysis/downloader";
import { analyzeContent, hasVideoModalityEvidence, summarizeCaptionToTitle } from "@/lib/server/analysis/gemini";
import { prepareParts, PreparePartsError } from "@/lib/server/analysis/media";
import { buildSystemInstruction, buildUserPrompt } from "@/lib/server/analysis/prompts";
import { parseContentAnalysis } from "@/lib/server/analysis/parser";
import type { AnalyzeResult } from "@/lib/server/analysis/types";
import { MAX_VIDEO_SECONDS } from "@/lib/server/analysis/constants";
import type { ProgressState } from "./progress";
import { createProgress, updateProgress } from "./progress";
import { resolveProfile } from "@/lib/server/profiles";
import type { Profile, ProfileInput } from "@/lib/server/profiles";
import type { OwnerProfileHint } from "@/lib/server/analysis/types";
import { recomputeFingerprint } from "@/lib/server/fingerprint";
import { computePerformanceBlock } from "@/lib/server/analysis/performance/computeBlock";
import { ANALYSIS_SCHEMA_VERSION } from "@/lib/server/analysis/schema/constants";

/**
 * OwnerProfileHint.username is `string | null` (extracted from a payload
 * that may not carry an owner block); ProfileInput.username is a required
 * `string` used as the cache key elsewhere. resolveProfile() never reads
 * ownerHint.username — it uses the already-resolved `metadata.username` —
 * so this strips it rather than fighting the type.
 */
function toProfileInputHint(hint: OwnerProfileHint | null): Partial<ProfileInput> | null {
  if (!hint) {
    return null;
  }
  return {
    externalId: hint.externalId,
    followerCount: hint.followerCount,
    followingCount: hint.followingCount,
    fullName: hint.fullName,
    profilePicUrl: hint.profilePicUrl,
    biography: hint.biography,
    isVerified: hint.isVerified,
    isBusinessAccount: hint.isBusinessAccount,
    isPrivate: hint.isPrivate,
  };
}

/** Boolean -> SQLite 0/1, preserving NULL for "unknown" (never coerced to 0). */
function toDbBool(value: boolean | null | undefined): number | null {
  return value == null ? null : value ? 1 : 0;
}

export interface RunAnalysisOptions {
  url: string;
  prompt: string;
  existingId?: string;
  onProgress?: (progress: ProgressState) => void;
}

export async function runAnalysis({
  url,
  prompt,
  existingId,
  onProgress,
}: RunAnalysisOptions): Promise<AnalyzeResult> {
  const classified = classifyUrl(url);
  if (!classified) {
    throw new Error("Unrecognized URL format");
  }

  const analysisId = existingId ?? randomUUID();
  const isReAnalyze = !!existingId;
  const progress = createProgress(1);
  const report = (step: Parameters<typeof updateProgress>[1], current: number, message: string) => {
    const next = updateProgress(progress, step, current, message);
    Object.assign(progress, next);
    onProgress?.(progress);
  };

  let tempFilePaths: string[] = [];

  try {
    if (isReAnalyze) {
      await db.execute({
        sql: `
          UPDATE analyses
          SET prompt = ?, status = 'pending', raw_gemini = NULL, result_content = NULL,
              result_created_at = NULL, analysis_mode = NULL, updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [prompt, analysisId],
      });
    } else {
      await db.execute({
        sql: `
          INSERT INTO analyses (id, prompt, status, url, platform, media_type)
          VALUES (?, ?, 'pending', ?, ?, ?)
        `,
        args: [analysisId, prompt, url, classified.platform, classified.mediaType],
      });
    }

    report("classifying", 1, "URL classified");
    report("fetching", 1, "Fetching content metadata...");

    const { metadata, ownerHint, reachResult } = await fetchMetadata(classified);

    console.log("[PIPELINE] Metadata fetched:");
    console.log(JSON.stringify(metadata, null, 2));

    report("profiling", 1, "Resolving creator profile...");

    let profile: Profile | null = null;
    try {
      profile = await resolveProfile({
        platform: classified.platform,
        username: metadata.username,
        ownerHint: toProfileInputHint(ownerHint),
      });
    } catch (error) {
      // A profile failure must never fail an analysis — follower-dependent
      // fields simply come out NULL.
      console.error("[PIPELINE] Profile resolve failed:", error);
      profile = null;
    }

    const followerCount = profile?.followerCount ?? null;

    // MediaMetadata.followerCount is documented as "filled by pipeline
    // after profile resolve" — buildUserPrompt() reads it straight off
    // `metadata`, so it must be assigned here, not just passed separately
    // to the DB write.
    metadata.followerCount = followerCount;

    report("summarizing", 1, "Generating title from caption...");
    const generatedTitle = await summarizeCaptionToTitle(metadata.caption ?? "");
    const finalTitle = generatedTitle ?? metadata.caption ?? null;

    // Q1=(a)/C3: `durationSec` is `null` for every carousel video part —
    // the guard SKIPS a null duration rather than coercing it to `0` (which
    // would happen to pass here anyway, but that's incidental, not the
    // rule). The guard still applies to a non-null duration on any media
    // type, so a >900s reel/post video is still rejected.
    if (metadata.durationSec !== null && metadata.durationSec !== undefined) {
      if (metadata.durationSec > MAX_VIDEO_SECONDS) {
        throw new Error(
          `Video duration (${metadata.durationSec}s) exceeds limit (${MAX_VIDEO_SECONDS}s)`,
        );
      }
    }

    let fileUri: string | null = null;
    let fileExpiresAt: string | null = null;
    // Step 5 (ticket #71): any video part -> 'full_video'; no video but
    // >=1 image part -> 'images_only' (pairs with the CAROUSEL_STATIC
    // format archetype — an all-image carousel that actually reaches
    // Gemini is neither of the other two values); no media at all ->
    // 'metadata_only'. Media was expected iff mediaParts is non-empty. If
    // media WAS expected but preparing it for Gemini fails (download or
    // upload failure on any part), the analysis fails loudly rather than
    // silently persisting a caption-only result that looks identical to a
    // real media analysis. No retry: first failure errors out (see catch
    // block below, which follows the existing delete/preserve-for-
    // re-analysis convention).
    let analysisMode: "full_video" | "images_only" | "metadata_only" = "metadata_only";

    // Ticket #295 code review, B2 -> H1 (owner ruling, 2026-08-26): for the
    // YouTube native-URL path, `analysisMode` cannot be decided yet at this
    // point in the function — it is only an INTENT here (we are about to
    // attempt a full-video analysis), not a fact. Whether Gemini actually
    // decoded the video is only knowable once its response comes back with
    // `usageMetadata`.
    //
    // The pre-call persisted value must therefore be the CONSERVATIVE
    // default ('metadata_only', already this variable's initial value —
    // nothing to assign here) rather than the optimistic one. B2's original
    // fix asserted 'full_video' provisionally and downgraded it after the
    // call; the reviewer found that ordering left a real window — for the
    // whole duration of the Gemini call, and permanently if the process is
    // killed before the correction runs — where a 'pending' row claimed
    // 'full_video' with zero evidence, an unearned claim structurally
    // identical to the one #288 was about. Inverting so the honest mode is
    // what a killed/errored process stalls on, and 'full_video' is only ever
    // written once `hasVideoModalityEvidence()` has proof, makes that
    // unearned claim structurally impossible rather than merely narrow: this
    // flag marks that the YouTube path must re-check analysisMode after
    // `analyzeContent()` returns and UPGRADE it (recomputing the performance
    // block to match) if and only if the evidence is present.
    let youtubeModeNeedsVerification = false;

    let geminiParts: Awaited<ReturnType<typeof prepareParts>>["geminiParts"] = [];

    if (classified.platform === "youtube") {
      // Ticket #295: Gemini's native YouTube URL input replaces yt-dlp +
      // download + File API upload, for the YouTube path ONLY —
      // Instagram's branch below (prepareParts()) is untouched.
      // `metadata.videoUrl` is the ORIGINAL public YouTube URL
      // (fetcher/router.ts no longer downloads or rewrites it); handed to
      // Gemini as a bare `fileData.fileUri` part with `mimeType`
      // deliberately omitted (verified request shape,
      // .claude/context/verified-facts.md). Google fetches the video
      // server-side, so there is no local file, no File API asset —
      // `fileUri`/`fileExpiresAt` (the `gemini_file_uri` column pair, a
      // File-API-upload artifact) correctly stay null on this path.
      //
      // #292's refusal behaviour is preserved STRUCTURALLY here, not by a
      // pre-check: there is no more free, local probe to run before this
      // point (that was `yt-dlp`, now gone). If Gemini genuinely cannot
      // obtain the video (private/removed/region-blocked — public videos
      // only is a documented limit of this preview feature),
      // `analyzeContent()` below throws, and this function's existing
      // catch block (delete the row for a first analysis, mark 'failed'
      // for a re-analysis) refuses exactly as before — no bespoke failure
      // branch needed (same reasoning as docs/audit/ANALYSIS-288 §5). The
      // #293 prompt guard remains the backstop if this preview feature is
      // ever withdrawn.
      if (!metadata.videoUrl) {
        throw new Error("YouTube analysis is missing a video URL to send to Gemini");
      }
      // M4: nothing is downloaded on this path — Gemini fetches the video
      // server-side from the bare `fileUri`. Stage + message now agree:
      // this is preparation for the analyze call, not a download step.
      report("analyzing", 1, "Preparing video for Gemini analysis...");
      geminiParts = [{ fileData: { fileUri: metadata.videoUrl } }];
      // `analysisMode` stays at its conservative default ('metadata_only')
      // here — see the comment above `youtubeModeNeedsVerification`. It is
      // only ever upgraded to 'full_video' after `analyzeContent()` returns
      // evidence that Gemini actually decoded the video.
      youtubeModeNeedsVerification = true;
    } else if (metadata.mediaParts && metadata.mediaParts.length > 0) {
      // Instagram (fetcher/adapter.ts, via resolveMediaParts()) populates
      // metadata.mediaParts directly — unchanged by ticket #295. The
      // videoUrl-only synthetic-part fallback that used to live here was
      // deleted: it existed solely for YouTube (the only platform whose
      // metadata carries a videoUrl without mediaParts), which now takes
      // the branch above instead. Instagram always populates mediaParts
      // whenever it sets videoUrl (fetcher/adapter.ts), so this branch
      // never relied on that fallback in the first place.
      const mediaParts = metadata.mediaParts;
      const hasVideoPart = mediaParts.some((part) => part.kind === "video");
      const label =
        mediaParts.length > 1 ? `Downloading ${mediaParts.length} media parts...` : "Downloading video...";
      report("downloading", 1, label);
      let prepared: Awaited<ReturnType<typeof prepareParts>>;
      try {
        prepared = await prepareParts(mediaParts);
      } catch (error) {
        // A PreparePartsError carries every temp file written BEFORE the
        // failure (e.g. slide 3 of 7's upload failing after slides 1-2
        // already downloaded to /tmp) — capture it here so the `finally`
        // block below still deletes all of them, not zero.
        if (error instanceof PreparePartsError) {
          tempFilePaths = error.tempFilePaths;
        }
        const reason = error instanceof Error ? error.message : String(error);
        const statusMatch = reason.match(/status (\d+)/);
        const status = statusMatch ? Number(statusMatch[1]) : null;
        const expiredHint =
          status === 403 || status === 404
            ? " A media URL has likely expired — re-running the analysis will fetch a fresh one."
            : "";
        throw new Error(`Media download/upload failed: ${reason}.${expiredHint}`);
      }

      tempFilePaths = prepared.tempFilePaths;
      geminiParts = prepared.geminiParts;
      fileUri = prepared.videoFileUris[0]?.uri ?? null;
      fileExpiresAt = prepared.videoFileUris[0]?.expiresAt ?? null;
      analysisMode = hasVideoPart ? "full_video" : "images_only";

      // Q3: MAX_TOTAL_MEDIA_BYTES can drop trailing parts independently of
      // the MAX_MEDIA_PARTS cap already applied when metadata.mediaParts
      // was built. Reconcile metadata.mediaParts to what was ACTUALLY sent
      // before the slide manifest is rendered (prompts/user.ts), so the
      // manifest never claims a slide that never reached Gemini.
      if (prepared.truncatedForBytes) {
        metadata.mediaParts = mediaParts.slice(0, prepared.preparedCount);
        metadata.mediaPartsTruncated = true;
      }
    }

    // Migration 009 (PR #95 fix-round, review items 4 and 9/(b)):
    // `coauthor_producers` is a JSON array of usernames — the natural
    // representation for `resolveCoauthorUsernames()`'s `string[]` output.
    // `like_and_view_counts_disabled` follows the repo's established
    // nullable-boolean convention (`toDbBool`, same as `has_audio`/
    // `audio_is_original` above) — NULL means "unknown", never coerced to
    // false, so the UI can tell "creator hid the counts" apart from
    // "never fetched".
    const coauthorProducersJson = JSON.stringify(metadata.coauthorUsernames ?? []);

    // Ticket #143 (TDD §2: `adapter -> computeBlock -> prompt-build`). Runs
    // once, here — its one DB read (`computeBaseline`'s Tier 2 query) is
    // deliberately the same round trip this stage was always going to make,
    // and the SAME resulting block is handed to `buildUserPrompt()` below,
    // to the prose guard (`parseContentAnalysis`) after Gemini responds, and
    // to the `perf_*` write in this same UPDATE — never recomputed.
    //
    // `audience_source_fetched_at` (step 4, TDD §1.3): a copy of
    // `profiles.last_fetched_at` taken NOW, at write time — `profiles.
    // last_fetched_at` is mutated by the next cache refresh, so this is the
    // only place a completed analysis can ever recover how stale its own
    // audience denominator was (R-13.3.2/R-13.4.5).
    //
    // `let`, not `const`: ticket #295 code review B2/H1 recomputes this once
    // more, below, for the YouTube path ONLY, if Gemini's response DOES
    // evidence real video decoding (an upgrade from the provisional
    // 'metadata_only' block computed here) — see
    // `youtubeModeNeedsVerification`.
    let computedBlock = await computePerformanceBlock({
      platform: classified.platform,
      mediaType: metadata.mediaType,
      analysisMode,
      reach: reachResult,
      likeCount: metadata.likeCount,
      commentCount: metadata.commentCount,
      likeAndViewCountsDisabled: metadata.likeAndViewCountsDisabled,
      followerCount,
      audienceSourceFetchedAt: profile?.lastFetchedAt ?? null,
      postDate: metadata.postDate,
      profileId: profile?.id ?? null,
      analysisId,
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
    });

    console.log("[PIPELINE] Computed performance block:");
    console.log(JSON.stringify(computedBlock, null, 2));

    await db.execute({
      sql: `
        UPDATE analyses
        SET username = ?, thumbnail_url = ?, video_url = ?, duration_sec = ?,
            view_count = ?, play_count = ?, post_date = ?, caption = ?, gemini_file_uri = ?,
            gemini_file_expires_at = ?, title = ?, media_type = ?,
            like_count = ?, comment_count = ?, has_audio = ?, audio_title = ?,
            audio_artist = ?, audio_id = ?, audio_is_original = ?,
            original_width = ?, original_height = ?, carousel_item_count = ?,
            profile_id = ?, follower_count = ?,
            analysis_mode = ?, coauthor_producers = ?, like_and_view_counts_disabled = ?,
            perf_reach_value = ?, perf_reach_kind = ?, perf_reach_derived_from = ?,
            perf_tier1_ratio = ?, perf_tier1_denominator = ?, perf_bucket_key = ?,
            perf_baseline_median = ?, perf_baseline_sample_size = ?, perf_multiplier = ?,
            perf_post_age_hours = ?, audience_source_fetched_at = ?,
            perf_tier_used = ?, perf_confidence = ?, perf_confidence_reason = ?,
            perf_provisional = ?, perf_unavailable_reason = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        metadata.username,
        metadata.thumbnailUrl,
        metadata.videoUrl,
        metadata.durationSec,
        metadata.viewCount,
        metadata.playCount ?? null,
        metadata.postDate,
        metadata.caption,
        fileUri,
        fileExpiresAt,
        finalTitle,
        metadata.mediaType,
        metadata.likeCount ?? null,
        metadata.commentCount ?? null,
        toDbBool(metadata.hasAudio),
        metadata.audioTitle ?? null,
        metadata.audioArtist ?? null,
        metadata.audioId ?? null,
        toDbBool(metadata.audioIsOriginal),
        metadata.originalWidth ?? null,
        metadata.originalHeight ?? null,
        metadata.carouselItemCount ?? null,
        profile?.id ?? null,
        followerCount,
        analysisMode,
        coauthorProducersJson,
        toDbBool(metadata.likeAndViewCountsDisabled),
        computedBlock.reach.value,
        computedBlock.reach.kind,
        computedBlock.reach.derivedFrom,
        computedBlock.tier1Ratio?.ratio ?? null,
        computedBlock.tier1Ratio?.denominator ?? null,
        computedBlock.bucketKey,
        computedBlock.baseline.state !== "COLD_START" ? computedBlock.baseline.median : null,
        computedBlock.baseline.sampleSize,
        computedBlock.baseline.state === "MEASURED" ? computedBlock.baseline.multiplier : null,
        computedBlock.postAgeHours != null ? Math.round(computedBlock.postAgeHours) : null,
        computedBlock.audienceSourceFetchedAt,
        computedBlock.tierUsed,
        computedBlock.confidence,
        computedBlock.confidenceReason,
        toDbBool(computedBlock.provisional),
        computedBlock.unavailableReason,
        analysisId,
      ],
    });

    report("analyzing", 0, "Running Gemini analysis...");

    const systemPrompt = buildSystemInstruction();
    const userPrompt = buildUserPrompt(metadata, prompt, computedBlock);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // PR #299 round-4 review: `computedBlock` is reassigned below (YouTube
    // upgrade branch) to a SECOND, independently-computed
    // `ComputedPerformanceBlock` — different `analysisMode` -> different
    // `bucketKey` -> a different baseline pool, per `computeBucketKey`
    // (`performance/baseline.ts`). `promptBlock` is captured here, BEFORE
    // that reassignment can happen, and is never itself reassigned — it is
    // pinned to the exact block `buildUserPrompt()` just used to build
    // `fullPrompt`, i.e. what Gemini actually saw. The prose guard
    // (`parseContentAnalysis`, called below) must check the model's output
    // against THIS block, not whatever `computedBlock` becomes after an
    // upgrade — the guard's own contract (`parser/analysis.ts`'s doc
    // comment) is "the SAME block the prompt was built from", and using the
    // post-upgrade `computedBlock` there would silently violate it.
    const promptBlock = computedBlock;

    const geminiResult = await analyzeContent(geminiParts, fullPrompt);

    // Ticket #295 code review, B2 -> H1 (owner ruling, 2026-08-26): stop
    // ASSERTING 'full_video' before proof exists, in either direction. The
    // provisional 'metadata_only' mode + performance block written above is
    // the honest default (it is exactly what a killed process, or a
    // concurrent viewer reading the row while `status = 'pending'`, is left
    // with). Now that the response has arrived, `usageMetadata` is the
    // mechanical evidence (see `hasVideoModalityEvidence`'s doc comment) —
    // if it DOES show a VIDEO-modality prompt token count, Gemini actually
    // decoded the video, and the row has now EARNED the 'full_video' claim.
    // Upgrade to the truthful mode and recompute the performance block so
    // `perf_bucket_key`/baseline stay consistent with the corrected
    // `analysis_mode` — this is a second LOCAL computation (one more DB read
    // inside `computePerformanceBlock`, no Gemini or ScrapeCreators spend)
    // against the same already-fetched inputs, not a second live call.
    if (youtubeModeNeedsVerification && hasVideoModalityEvidence(geminiResult.usageMetadata)) {
      console.log(
        "[PIPELINE] YouTube analysis_mode upgraded: Gemini's response carries VIDEO-modality " +
          "usageMetadata, so the video was actually decoded. Recording the earned 'full_video' " +
          "claim instead of the provisional 'metadata_only' default.",
      );
      analysisMode = "full_video";
      computedBlock = await computePerformanceBlock({
        platform: classified.platform,
        mediaType: metadata.mediaType,
        analysisMode,
        reach: reachResult,
        likeCount: metadata.likeCount,
        commentCount: metadata.commentCount,
        likeAndViewCountsDisabled: metadata.likeAndViewCountsDisabled,
        followerCount,
        audienceSourceFetchedAt: profile?.lastFetchedAt ?? null,
        postDate: metadata.postDate,
        profileId: profile?.id ?? null,
        analysisId,
        schemaVersion: ANALYSIS_SCHEMA_VERSION,
      });

      await db.execute({
        sql: `
          UPDATE analyses
          SET analysis_mode = ?,
              perf_reach_value = ?, perf_reach_kind = ?, perf_reach_derived_from = ?,
              perf_tier1_ratio = ?, perf_tier1_denominator = ?, perf_bucket_key = ?,
              perf_baseline_median = ?, perf_baseline_sample_size = ?, perf_multiplier = ?,
              perf_tier_used = ?, perf_confidence = ?, perf_confidence_reason = ?,
              perf_provisional = ?, perf_unavailable_reason = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [
          analysisMode,
          computedBlock.reach.value,
          computedBlock.reach.kind,
          computedBlock.reach.derivedFrom,
          computedBlock.tier1Ratio?.ratio ?? null,
          computedBlock.tier1Ratio?.denominator ?? null,
          computedBlock.bucketKey,
          computedBlock.baseline.state !== "COLD_START" ? computedBlock.baseline.median : null,
          computedBlock.baseline.sampleSize,
          computedBlock.baseline.state === "MEASURED" ? computedBlock.baseline.multiplier : null,
          computedBlock.tierUsed,
          computedBlock.confidence,
          computedBlock.confidenceReason,
          toDbBool(computedBlock.provisional),
          computedBlock.unavailableReason,
          analysisId,
        ],
      });
    }

    // `promptBlock`, not `computedBlock` — see the comment above its
    // declaration. `computedBlock` may have since been upgraded to
    // 'full_video' (a different bucket/baseline); the guard must still
    // check against what the prompt actually contained.
    const content = parseContentAnalysis(geminiResult.text, metadata, promptBlock);

    console.log("[PIPELINE] Parsed analysis:");
    console.log(JSON.stringify(content, null, 2));

    report("saving", 0, "Saving results...");

    // Step 5: `performance_score` is promoted to its own column (TDD §5.2,
    // OR-8 — 3C paginates/sorts server-side, so it cannot live only inside
    // the `result_content` JSON blob).
    await db.execute({
      sql: `
        UPDATE analyses
        SET raw_gemini = ?, result_content = ?, result_created_at = datetime('now'),
            status = 'completed', schema_version = ?, performance_score = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        geminiResult.raw,
        JSON.stringify(content),
        content.schemaVersion,
        content.performance.performanceScore,
        analysisId,
      ],
    });

    report("complete", 1, "Analysis complete");

    // Step 7 (ticket #72): recompute the profile's style fingerprint after
    // the analysis result is persisted, inside a try/catch that logs and
    // swallows — the same convention resolveProfile() already uses above.
    // A fingerprint failure must never fail an analysis.
    if (profile?.id) {
      try {
        await recomputeFingerprint(profile.id);
      } catch (error) {
        console.error("[PIPELINE] Fingerprint recompute failed:", error);
      }
    }

    return {
      analysisId,
      content,
      rawGemini: geminiResult.raw,
    };
  } catch (error) {
    report("error", 0, error instanceof Error ? error.message : "Analysis failed");
    if (!isReAnalyze) {
      await db.execute({
        sql: "DELETE FROM analyses WHERE id = ?",
        args: [analysisId],
      });
    } else {
      await db.execute({
        sql: "UPDATE analyses SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
        args: [analysisId],
      });
    }
    throw error;
  } finally {
    // Every temp file written during prepareParts() — not just one
    // videoPath — including any downloaded before a later slide's
    // download/upload failed (a mid-carousel partial failure).
    await Promise.all(tempFilePaths.map((path) => deleteTempFile(path)));
  }
}
