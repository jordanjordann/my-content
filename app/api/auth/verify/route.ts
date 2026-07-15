import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  createSessionToken,
  validatePin,
  verifyPin,
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

  if (!(await verifyPin(body.pin))) {
    return NextResponse.json(
      { ok: false, error: "Invalid PIN." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(), authCookieOptions);
  return response;
}
