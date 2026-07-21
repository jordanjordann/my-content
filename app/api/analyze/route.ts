import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/server/auth";
import { runAnalysis } from "@/lib/server/analysis/pipeline";
import { MAX_URLS_PER_BATCH } from "@/lib/server/analysis/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { urls, prompt, existingId } = body as {
      urls?: unknown;
      prompt?: unknown;
      existingId?: string;
    };

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "No URLs provided." }, { status: 400 });
    }

    if (urls.length > MAX_URLS_PER_BATCH) {
      return NextResponse.json(
        { error: `Too many URLs (max ${MAX_URLS_PER_BATCH}).` },
        { status: 400 },
      );
    }

    const invalidUrls = urls.filter((u) => typeof u !== "string");
    if (invalidUrls.length > 0) {
      return NextResponse.json({ error: "All URLs must be strings." }, { status: 400 });
    }

    if (typeof existingId === "string" && existingId.length > 0 && urls.length > 1) {
      return NextResponse.json(
        {
          error:
            "existingId can only be used with a single URL. Re-analysis targets one existing row and cannot be applied to a batch.",
        },
        { status: 400 },
      );
    }

    const analysisPrompt = typeof prompt === "string" ? prompt : "";
    const analysisIds: string[] = [];
    const failedUrls: { url: string; index: number; error: string }[] = [];

    for (const [index, url] of (urls as string[]).entries()) {
      try {
        const result = await runAnalysis({ url, prompt: analysisPrompt, existingId });
        analysisIds.push(result.analysisId);
      } catch (error) {
        failedUrls.push({
          url,
          index,
          error: error instanceof Error ? error.message : "Analysis failed.",
        });
      }
    }

    return NextResponse.json({
      analysisIds,
      analysesCreated: analysisIds.length,
      failedUrls,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 500 },
    );
  }
}
