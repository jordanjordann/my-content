import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  createSessionToken,
  setupPin,
  validatePin,
} from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;

  if (!validatePin(body?.pin)) {
    return NextResponse.json(
      { ok: false, error: "PIN must be exactly 4 digits." },
      { status: 400 },
    );
  }

  try {
    await setupPin(body.pin);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(), authCookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to set PIN.",
      },
      { status: 400 },
    );
  }
}
