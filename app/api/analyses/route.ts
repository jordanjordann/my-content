import { NextResponse } from "next/server";

import {
  getAnalysesList,
  getUniqueAccounts,
  deleteAnalysis,
} from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";
import type { ContentAnalysis } from "@/lib/api/analyses/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [analyses, accounts] = await Promise.all([getAnalysesList(), getUniqueAccounts()]);

    const analysesWithDetails = analyses.map((analysis) => {
        let overallScore: number | null = null;
        let scorecard: ContentAnalysis["scorecard"] | null = null;
        if (analysis.resultContent) {
          try {
            const parsed = JSON.parse(analysis.resultContent) as Partial<ContentAnalysis>;
            overallScore = typeof parsed.overallScore === "number" ? parsed.overallScore : null;
            scorecard = parsed.scorecard ?? null;
          } catch {
            // Ignore parse errors
          }
        }

        return {
          id: analysis.id,
          prompt: analysis.prompt,
          status: analysis.status,
          url: analysis.url,
          platform: analysis.platform,
          mediaType: analysis.mediaType,
          username: analysis.username,
          overallScore,
          scorecard,
          // Lets the UI degrade gracefully on a version it doesn't know how
          // to render (TDD §3.3, §8.2) — null on rows that predate the
          // redesign (migration 007, no backfill).
          schemaVersion: analysis.schemaVersion,
          thumbnailUrl: analysis.thumbnailUrl,
          viewCount: analysis.viewCount,
          postDate: analysis.postDate,
          durationSec: analysis.durationSec,
          caption: analysis.caption,
          title: analysis.title,
          createdAt: analysis.createdAt,
        };
      });

    return NextResponse.json({
      analyses: analysesWithDetails,
      accounts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch analyses." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing analysis ID." }, { status: 400 });
    }

    await deleteAnalysis(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete analysis." },
      { status: 500 },
    );
  }
}
