import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { classifyUrl } from "@/lib/server/analysis/classifier";
import { fetchMetadata } from "@/lib/server/analysis/fetcher";
import { deleteTempFile } from "@/lib/server/analysis/downloader";
import { analyzeContent } from "@/lib/server/analysis/gemini";
import { prepareParts, PreparePartsError } from "@/lib/server/analysis/media";
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
    // Instagram (fetcher/adapter.ts, via resolveMediaParts()) populates
    // metadata.mediaParts directly. YouTube (fetcher/youtube.ts) is
    // untouched by this ticket and only ever sets metadata.videoUrl — fall
    // back to a single synthetic video part built from it so the YouTube
    // path keeps working unchanged through the now-shared prepareParts().
    const mediaParts =
      metadata.mediaParts && metadata.mediaParts.length > 0
        ? metadata.mediaParts
        : metadata.videoUrl
          ? [
              {
                index: 0,
                kind: "video" as const,
                url: metadata.videoUrl,
                durationSec: metadata.durationSec ?? null,
                width: metadata.originalWidth ?? null,
                height: metadata.originalHeight ?? null,
                playCount: metadata.playCount ?? null,
                viewCount: metadata.viewCount ?? null,
                displayedCountIsPlayCount: metadata.displayedCountIsPlayCount ?? false,
              },
            ]
          : [];
    const hasVideoPart = mediaParts.some((part) => part.kind === "video");

    let geminiParts: Awaited<ReturnType<typeof prepareParts>>["geminiParts"] = [];

    if (mediaParts.length > 0) {
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

    await db.execute({
      sql: `
        UPDATE analyses
        SET username = ?, thumbnail_url = ?, video_url = ?, duration_sec = ?,
            view_count = ?, play_count = ?, post_date = ?, caption = ?, gemini_file_uri = ?,
            gemini_file_expires_at = ?, title = ?, media_type = ?,
            like_count = ?, comment_count = ?, has_audio = ?, audio_title = ?,
            audio_artist = ?, audio_id = ?, audio_is_original = ?,
            original_width = ?, original_height = ?, carousel_item_count = ?,
            profile_id = ?, follower_count = ?, engagement_rate = ?,
            analysis_mode = ?, coauthor_producers = ?, like_and_view_counts_disabled = ?,
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
        engagementRate,
        analysisMode,
        coauthorProducersJson,
        toDbBool(metadata.likeAndViewCountsDisabled),
        analysisId,
      ],
    });

    report("analyzing", 0, "Running Gemini analysis...");

    const systemPrompt = buildSystemInstruction();
    const userPrompt = buildUserPrompt(metadata, prompt);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const geminiResult = await analyzeContent(geminiParts, fullPrompt);
    const content = parseContentAnalysis(geminiResult.text);

    console.log("[PIPELINE] Parsed analysis:");
    console.log(JSON.stringify(content, null, 2));

    report("saving", 0, "Saving results...");

    await db.execute({
      sql: `
        UPDATE analyses
        SET raw_gemini = ?, result_content = ?, result_created_at = datetime('now'),
            status = 'completed', schema_version = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [geminiResult.raw, JSON.stringify(content), content.schemaVersion, analysisId],
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
    // Every temp file written during prepareParts() — not just one
    // videoPath — including any downloaded before a later slide's
    // download/upload failed (a mid-carousel partial failure).
    await Promise.all(tempFilePaths.map((path) => deleteTempFile(path)));
  }
}
