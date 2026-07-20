import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { classifyUrl } from "@/lib/server/analysis/classifier";
import { fetchMetadata } from "@/lib/server/analysis/fetcher";
import { downloadVideo, deleteTempFile } from "@/lib/server/analysis/downloader";
import { uploadToGemini, analyzeContent } from "@/lib/server/analysis/gemini";
import { buildSystemInstruction, buildUserPrompt } from "@/lib/server/analysis/prompts";
import { parseContentAnalysis } from "@/lib/server/analysis/parser";
import type { AnalyzeResult } from "@/lib/server/analysis/types";
import { MAX_VIDEO_SECONDS } from "@/lib/server/analysis/constants";
import type { ProgressState } from "./progress";
import { createProgress, updateProgress } from "./progress";
import { summarizeCaptionToTitle } from "@/lib/server/ollama";

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
              result_created_at = NULL, updated_at = datetime('now')
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

    // NOTE: profile resolution, media_type reconciliation and carousel video
    // selection land in #35 (pipeline wiring). This is a minimal, build-
    // green adjustment to the new fetchMetadata() return shape and removal
    // of the now-deleted Playwright browser lifecycle.
    const { metadata } = await fetchMetadata(classified);

    console.log("[PIPELINE] Metadata fetched:");
    console.log(JSON.stringify(metadata, null, 2));

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

    if (metadata.videoUrl && (metadata.mediaType === "reel" || metadata.mediaType === "short")) {
      report("downloading", 1, "Downloading video...");
      videoPath = await downloadVideo(metadata.videoUrl);

      report("uploading", 1, "Uploading video...");
      const uploadedFile = await uploadToGemini(videoPath);
      fileUri = uploadedFile.uri;
      fileExpiresAt = uploadedFile.expiresAt;
    }

    await db.execute({
      sql: `
        UPDATE analyses
        SET username = ?, thumbnail_url = ?, video_url = ?, duration_sec = ?,
            view_count = ?, post_date = ?, caption = ?, gemini_file_uri = ?,
            gemini_file_expires_at = ?, title = ?, updated_at = datetime('now')
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
