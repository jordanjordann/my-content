import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  checkPinRateLimit,
  createSessionToken,
  recordPinFailure,
  recordPinSuccess,
  validatePin,
  verifyPin,
} from "@/lib/server/auth";

export const runtime = "nodejs";

function getClientKey(request: Request): string {
  // Best-effort client identifier for rate limiting. `x-forwarded-for` may
  // contain a chain of proxies — the first entry is the original client.
  // Falls back to a shared key when no forwarding header is present (e.g.
  // direct connections in local/dev), which still rate-limits, just per
  // process rather than per-IP.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstIp = forwardedFor?.split(",")[0]?.trim();
  return firstIp || "unknown";
}

export async function POST(request: Request) {
  const clientKey = getClientKey(request);

  const rateLimitStatus = checkPinRateLimit(clientKey);
  if (rateLimitStatus.limited) {
    const retryAfterSeconds = Math.ceil(rateLimitStatus.retryAfterMs / 1000);
    return NextResponse.json(
      {
        ok: false,
        error: "Too many failed attempts. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;

  if (!validatePin(body?.pin)) {
    return NextResponse.json(
      { ok: false, error: "PIN must be exactly 4 digits." },
      { status: 400 },
    );
  }

  if (!(await verifyPin(body.pin))) {
    recordPinFailure(clientKey);
    return NextResponse.json(
      { ok: false, error: "Invalid PIN." },
      { status: 401 },
    );
  }

  recordPinSuccess(clientKey);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(), authCookieOptions);
  return response;
}
