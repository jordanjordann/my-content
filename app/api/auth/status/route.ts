import { NextResponse } from "next/server";

import { hasPinConfigured, isAuthenticated } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [pinConfigured, authenticated] = await Promise.all([
      hasPinConfigured(),
      isAuthenticated(),
    ]);

    return NextResponse.json({ pinConfigured, authenticated });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to read auth status.",
      },
      { status: 500 },
    );
  }
}
