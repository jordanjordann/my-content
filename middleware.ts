import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "my_content_session";

const protectedPaths = ["/analyses"];
const publicPaths = ["/auth/pin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = token !== undefined;

  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!isAuthenticated) {
      const url = new URL("/auth/pin", request.url);
      return NextResponse.redirect(url);
    }
  }

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    if (isAuthenticated) {
      const url = new URL("/analyses", request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
