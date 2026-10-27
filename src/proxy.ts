import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/setup"];

/**
 * Optimistic gate: bounces visitors without a session cookie to /login.
 * It never trusts the cookie for data access; getCurrentUser() validates the
 * session close to the data. Signed-in users are not redirected away from
 * /login here, which would loop on an expired cookie.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (!getSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
