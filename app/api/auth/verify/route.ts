import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  checkGlobalPinRateLimit,
  checkPinRateLimit,
  createSessionToken,
  recordGlobalPinFailure,
  recordGlobalPinSuccess,
  recordPinFailure,
  recordPinSuccess,
  TRUST_PROXY_HEADERS,
  validatePin,
  verifyPin,
} from "@/lib/server/auth";

export const runtime = "nodejs";

// Shared key used whenever we don't trust the client-supplied identifier.
// See TRUST_PROXY_HEADERS in lib/server/auth/constants.ts for why: without
// an explicit, deliberately-configured trusted proxy in front, there is no
// attacker-proof way to derive a per-client IP in this Next.js version — a
// plain `Request` in a route handler exposes no verified peer address, and
// `NextRequest.ip`/`.geo` were removed in Next 15. Falling back to a fixed
// key still rate-limits (just per-process instead of per-IP), and the
// global limiter below (checkGlobalPinRateLimit) is the actual backstop
// against brute force regardless of client identity.
const UNTRUSTED_CLIENT_KEY = "shared";

function getClientKey(request: Request): string {
  if (!TRUST_PROXY_HEADERS) {
    return UNTRUSTED_CLIENT_KEY;
  }

  // Only reached when the deployer has explicitly opted in via
  // TRUST_PROXY_HEADERS, asserting that a trusted reverse proxy overwrites
  // this header with the real peer address before it reaches this process.
  // `x-forwarded-for` may contain a chain of proxies — the first entry is
  // the original client.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstIp = forwardedFor?.split(",")[0]?.trim();
  return firstIp || UNTRUSTED_CLIENT_KEY;
}

export async function POST(request: Request) {
  const clientKey = getClientKey(request);

  const globalStatus = checkGlobalPinRateLimit();
  if (globalStatus.limited) {
    const retryAfterSeconds = Math.ceil(globalStatus.retryAfterMs / 1000);
    return NextResponse.json(
      {
        ok: false,
        error: "Too many failed attempts. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

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
    recordGlobalPinFailure();
    return NextResponse.json(
      { ok: false, error: "Invalid PIN." },
      { status: 401 },
    );
  }

  recordPinSuccess(clientKey);
  recordGlobalPinSuccess();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(), authCookieOptions);
  return response;
}
