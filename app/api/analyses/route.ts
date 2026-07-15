import { NextResponse } from "next/server";

import {
  getAnalysesList,
  getUniqueAccounts,
  getAnalysisPlatforms,
  getAnalysisResult,
  deleteAnalysis,
} from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [analyses, accounts] = await Promise.all([getAnalysesList(), getUniqueAccounts()]);

    const analysesWithDetails = await Promise.all(
      analyses.map(async (analysis) => {
        const [platforms, resultContent] = await Promise.all([
          getAnalysisPlatforms(analysis.id),
          getAnalysisResult(analysis.id),
        ]);

        let overallScore: number | null = null;
        if (resultContent) {
          try {
            const parsed = JSON.parse(resultContent) as { overallScore?: number };
            overallScore = typeof parsed.overallScore === "number" ? parsed.overallScore : null;
          } catch {
            // Ignore parse errors
          }
        }

        return {
          id: analysis.id,
          prompt: analysis.prompt,
          status: analysis.status,
          itemCount: analysis.itemCount,
          platforms,
          overallScore,
          createdAt: analysis.createdAt,
        };
      }),
    );

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
