import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { classifyUrl } from "@/lib/server/analysis/classifier";
import { fetchMetadata } from "@/lib/server/analysis/fetcher";
import { downloadVideo, deleteTempFile } from "@/lib/server/analysis/downloader";
import { uploadToGemini, pollUntilReady, analyzeContent } from "@/lib/server/analysis/gemini";
import { buildSystemInstruction, buildUserPrompt } from "@/lib/server/analysis/prompts";
import { parseContentAnalysis } from "@/lib/server/analysis/parser";
import type { AnalyzeResult } from "@/lib/server/analysis/types";
import { MAX_VIDEO_SECONDS } from "@/lib/server/analysis/constants";
import type { ProgressState } from "./progress";
import { createProgress, updateProgress } from "./progress";
import { summarizeCaptionToTitle } from "@/lib/server/ollama";
import { resolveProfile, computeEngagementRate } from "@/lib/server/profiles";
import type { Profile, ProfileInput } from "@/lib/server/profiles";
import type { OwnerProfileHint } from "@/lib/server/analysis/types";

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

  let videoPath: string | null = null;

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

    const { metadata, ownerHint } = await fetchMetadata(classified);

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
      // A profile failure must never fail an analysis — engagement rate
      // simply comes out NULL.
      console.error("[PIPELINE] Profile resolve failed:", error);
      profile = null;
    }

    const followerCount = profile?.followerCount ?? null;
    const engagementRate = computeEngagementRate({
      likeCount: metadata.likeCount,
      commentCount: metadata.commentCount,
      followerCount,
    });

    // MediaMetadata.followerCount/.engagementRate are documented as "filled
    // by pipeline after profile resolve" — buildUserPrompt() (and its
    // engagement-context block) reads them straight off `metadata`, so they
    // must be assigned here, not just passed separately to the DB write.
    metadata.followerCount = followerCount;
    metadata.engagementRate = engagementRate;

    report("summarizing", 1, "Generating title from caption...");
    const generatedTitle = await summarizeCaptionToTitle(metadata.caption ?? "");
    const finalTitle = generatedTitle ?? metadata.caption ?? null;

    if ((metadata.durationSec ?? 0) > MAX_VIDEO_SECONDS) {
      throw new Error(
        `Video duration (${metadata.durationSec}s) exceeds limit (${MAX_VIDEO_SECONDS}s)`,
      );
    }

    let fileUri: string | null = null;
    let fileExpiresAt: string | null = null;
    // A video was expected iff metadata.videoUrl resolved non-null (video
    // post/reel, or a carousel with a video child). NULL videoUrl is not
    // an error — that's a legitimate image post/carousel and must still
    // succeed as 'metadata_only'. If a video WAS expected but we cannot
    // get it in front of Gemini (download or upload failure), the
    // analysis must fail loudly rather than silently persist a
    // caption-only result that looks identical to a real video analysis.
    // No retry: first failure errors out (see catch block below, which
    // follows the same delete/preserve-for-re-analysis convention as the
    // existing "content not found" failure path).
    let analysisMode: "full_video" | "metadata_only" = "metadata_only";

    if (metadata.videoUrl) {
      report("downloading", 1, "Downloading video...");
      let downloadedPath: string;
      try {
        downloadedPath = await downloadVideo(metadata.videoUrl);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const statusMatch = reason.match(/status (\d+)/);
        const status = statusMatch ? Number(statusMatch[1]) : null;
        const expiredHint =
          status === 403 || status === 404
            ? " The video URL has likely expired — re-running the analysis will fetch a fresh one."
            : "";
        throw new Error(`Video download failed: ${reason}.${expiredHint}`);
      }
      videoPath = downloadedPath;

      report("uploading", 1, "Uploading video...");
      try {
        const uploadedFile = await uploadToGemini(videoPath);
        // Gemini processes uploads asynchronously — the file isn't
        // guaranteed usable the instant uploadFile() resolves. Without
        // this wait, analyzeContent() can race Gemini and fail with
        // "File is not in an ACTIVE state", which — if left uncaught
        // here — would be indistinguishable from a genuine analysis
        // failure downstream instead of a delivery failure.
        await pollUntilReady(uploadedFile.uri);
        fileUri = uploadedFile.uri;
        fileExpiresAt = uploadedFile.expiresAt;
        analysisMode = "full_video";
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Video upload to Gemini failed: ${reason}`);
      }
    }

    await db.execute({
      sql: `
        UPDATE analyses
        SET username = ?, thumbnail_url = ?, video_url = ?, duration_sec = ?,
            view_count = ?, post_date = ?, caption = ?, gemini_file_uri = ?,
            gemini_file_expires_at = ?, title = ?, media_type = ?,
            like_count = ?, comment_count = ?, has_audio = ?, audio_title = ?,
            audio_artist = ?, audio_id = ?, audio_is_original = ?,
            original_width = ?, original_height = ?, carousel_item_count = ?,
            profile_id = ?, follower_count = ?, engagement_rate = ?,
            analysis_mode = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        metadata.username,
        metadata.thumbnailUrl,
        metadata.videoUrl,
        metadata.durationSec,
        metadata.viewCount,
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
        engagementRate,
        analysisMode,
        analysisId,
      ],
    });

    report("analyzing", 0, "Running Gemini analysis...");

    const systemPrompt = buildSystemInstruction();
    const userPrompt = buildUserPrompt(metadata, prompt);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const geminiResult = await analyzeContent(fileUri, fullPrompt);
    const content = parseContentAnalysis(geminiResult.text);

    console.log("[PIPELINE] Parsed analysis:");
    console.log(JSON.stringify(content, null, 2));

    report("saving", 0, "Saving results...");

    await db.execute({
      sql: `
        UPDATE analyses
        SET raw_gemini = ?, result_content = ?, result_created_at = datetime('now'),
            status = 'completed', updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [geminiResult.raw, JSON.stringify(content), analysisId],
    });

    report("complete", 1, "Analysis complete");

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
    if (videoPath) {
      await deleteTempFile(videoPath);
    }
  }
}
