import { NextResponse } from "next/server";

import { getAnalysisDetail, getAnalysisResult } from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const detail = await getAnalysisDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    const resultContent = await getAnalysisResult(id);
    let results: unknown = null;
    if (resultContent) {
      try {
        results = JSON.parse(resultContent);
      } catch {
        results = null;
      }
    }

    return NextResponse.json({
      id: detail.id,
      prompt: detail.prompt,
      status: detail.status,
      items: detail.items,
      results,
      createdAt: detail.createdAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch analysis." },
      { status: 500 },
    );
  }
}
