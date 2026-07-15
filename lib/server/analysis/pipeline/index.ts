import { randomUUID } from "node:crypto";
import type { BrowserContext } from "playwright";
import { db } from "@/lib/server/db";
import { classifyUrl } from "@/lib/server/analysis/classifier";
import { fetchMetadata, initBrowser, loadOrCreateContext, closeBrowser } from "@/lib/server/analysis/fetcher";
import { downloadVideo, deleteTempFile } from "@/lib/server/analysis/downloader";
import { uploadToGemini, analyzeContent } from "@/lib/server/analysis/gemini";
import { buildSystemInstruction, buildUserPrompt } from "@/lib/server/analysis/prompts";
import { parseContentAnalysis } from "@/lib/server/analysis/parser";
import type { MediaMetadata, AnalyzeResult } from "@/lib/server/analysis/types";
import { MAX_URLS_PER_BATCH, MAX_VIDEO_SECONDS_PER_BATCH } from "@/lib/server/analysis/constants";
import type { ProgressState } from "./progress";
import { createProgress, updateProgress } from "./progress";

export interface RunAnalysisOptions {
  urls: string[];
  prompt: string;
  onProgress?: (progress: ProgressState) => void;
}

export async function runAnalysis({
  urls,
  prompt,
  onProgress,
}: RunAnalysisOptions): Promise<AnalyzeResult> {
  if (urls.length === 0 || urls.length > MAX_URLS_PER_BATCH) {
    throw new Error(`URL count must be between 1 and ${MAX_URLS_PER_BATCH}`);
  }

  const analysisId = randomUUID();
  const progress = createProgress(urls.length);
  const report = (step: Parameters<typeof updateProgress>[1], current: number, message: string) => {
    const next = updateProgress(progress, step, current, message);
    Object.assign(progress, next);
    onProgress?.(progress);
  };

  const failedItems: { url: string; index: number; error: string }[] = [];
  const metadataList: MediaMetadata[] = [];
  const fileUris: string[] = [];
  const videoPaths: string[] = [];

  const browser = await initBrowser();
  let context: BrowserContext | undefined;

  try {
    context = await loadOrCreateContext(browser);

    report("classifying", 0, "Classifying URLs...");

    const classified = urls.map((url, i) => ({ url, index: i, classified: classifyUrl(url) }));
    const valid = classified.filter((c) => c.classified !== null);
    const invalid = classified.filter((c) => c.classified === null);

    for (const item of invalid) {
      failedItems.push({ url: item.url, index: item.index, error: "Unrecognized URL format" });
    }

    report("fetching", 0, `Fetching metadata for ${valid.length} item(s)...`);

    for (let i = 0; i < valid.length; i++) {
      const { url, index, classified } = valid[i]!;
      report("fetching", i + 1, `Fetching metadata for item ${i + 1} of ${valid.length}...`);

      try {
        const metadata = await fetchMetadata(classified!, context);
        metadataList.push(metadata);

        if (metadata.videoUrl && (metadata.mediaType === "reel" || metadata.mediaType === "short")) {
          report("downloading", i + 1, `Downloading video for item ${i + 1}...`);
          const videoPath = await downloadVideo(metadata.videoUrl);
          videoPaths.push(videoPath);

          report("uploading", i + 1, `Uploading video for item ${i + 1}...`);
          const { uri, expiresAt } = await uploadToGemini(videoPath);
          fileUris.push(uri);

          await db.execute({
            sql: `
              INSERT INTO content_items (id, analysis_id, url, platform, media_type, username, thumbnail_url, video_url, duration_sec, view_count, post_date, caption, gemini_file_uri, gemini_file_expires_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              randomUUID(),
              analysisId,
              url,
              classified!.platform,
              classified!.mediaType,
              metadata.username,
              metadata.thumbnailUrl,
              metadata.videoUrl,
              metadata.durationSec,
              metadata.viewCount,
              metadata.postDate,
              metadata.caption,
              uri,
              expiresAt,
            ],
          });
        } else {
          await db.execute({
            sql: `
              INSERT INTO content_items (id, analysis_id, url, platform, media_type, username, thumbnail_url, video_url, duration_sec, view_count, post_date, caption)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              randomUUID(),
              analysisId,
              url,
              classified!.platform,
              classified!.mediaType,
              metadata.username,
              metadata.thumbnailUrl,
              metadata.videoUrl,
              metadata.durationSec,
              metadata.viewCount,
              metadata.postDate,
              metadata.caption,
            ],
          });
        }
      } catch (err) {
        failedItems.push({
          url,
          index,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    if (metadataList.length === 0) {
      throw new Error("No valid content items to analyze");
    }

    const totalDuration = metadataList.reduce((sum, m) => sum + (m.durationSec ?? 0), 0);
    if (totalDuration > MAX_VIDEO_SECONDS_PER_BATCH) {
      throw new Error(
        `Total video duration (${totalDuration}s) exceeds limit (${MAX_VIDEO_SECONDS_PER_BATCH}s)`,
      );
    }

    report("analyzing", 0, "Running Gemini analysis...");

    const systemPrompt = buildSystemInstruction();
    const userPrompt = buildUserPrompt(metadataList, prompt);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const geminiResult = await analyzeContent(fileUris, metadataList, fullPrompt);
    const content = parseContentAnalysis(geminiResult.text);

    report("saving", 0, "Saving results...");

    await db.execute({
      sql: `
        INSERT INTO analyses (id, prompt, raw_gemini, status)
        VALUES (?, ?, ?, 'completed')
      `,
      args: [analysisId, prompt, geminiResult.raw],
    });

    await db.execute({
      sql: `
        INSERT INTO analysis_results (id, analysis_id, content)
        VALUES (?, ?, ?)
      `,
      args: [randomUUID(), analysisId, JSON.stringify(content)],
    });

    report("complete", metadataList.length, "Analysis complete");

    return {
      analysisId,
      itemsAnalyzed: metadataList.length,
      failedItems,
      content,
      rawGemini: geminiResult.raw,
    };
  } catch (error) {
    await db.execute({
      sql: `
        INSERT INTO analyses (id, prompt, raw_gemini, status)
        VALUES (?, ?, ?, 'failed')
      `,
      args: [analysisId, prompt, error instanceof Error ? error.message : "Unknown error"],
    });

    report("error", 0, error instanceof Error ? error.message : "Analysis failed");
    throw error;
  } finally {
    for (const path of videoPaths) {
      await deleteTempFile(path);
    }
    if (browser) {
      await closeBrowser(browser);
    }
  }
}
