import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/server/auth/constants";
import { verifySessionToken } from "@/lib/server/auth/auth";

const protectedPaths = ["/app"];
const publicPaths = ["/auth/pin"];

// Proxy defaults to the Node.js runtime as of Next.js 16, so `node:crypto`
// (used inside verifySessionToken) is safe to call here. This reuses the
// same HMAC-signed, expiry-checked verification as the API routes'
// isAuthenticated() — cookie presence alone is NOT sufficient proof of auth.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = verifySessionToken(token);

  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!isAuthenticated) {
      const url = new URL("/auth/pin", request.url);
      return NextResponse.redirect(url);
    }
  }

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    if (isAuthenticated) {
      const url = new URL("/app/analyses", request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
