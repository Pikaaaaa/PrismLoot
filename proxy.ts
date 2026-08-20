import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CONSOLE_REQUEST_HEADER,
  CONSOLE_REST_HEADER,
  consoleRest,
  getAdminBasePath,
  isAdminBasePath,
  isInternalConsolePath,
  rewriteAdminToInternal,
} from "@/lib/admin/path";
import { isSteamRequiredPath } from "@/lib/auth/gates";
import { allowLocalSession } from "@/lib/auth/local";
import { PLAYER_SESSION_COOKIE } from "@/lib/auth/session";
import { STEAM_LOGIN_PATH } from "@/lib/auth/steam";

function missingRewrite(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/__not_found_pl";
  const requestHeaders = new Headers(request.headers);
  // Skip the public store so this 404 still renders if catalog validation is mid-change.
  requestHeaders.set(CONSOLE_REQUEST_HEADER, "1");
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/") || isInternalConsolePath(pathname)) {
    return missingRewrite(request);
  }

  if (isAdminBasePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = rewriteAdminToInternal(pathname);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CONSOLE_REQUEST_HEADER, "1");
    requestHeaders.set(CONSOLE_REST_HEADER, consoleRest(pathname, getAdminBasePath()));
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  if (
    !pathname.startsWith("/api/") &&
    isSteamRequiredPath(pathname) &&
    !request.cookies.get(PLAYER_SESSION_COOKIE)?.value &&
    !allowLocalSession(request.headers)
  ) {
    const steam = request.nextUrl.clone();
    steam.pathname = STEAM_LOGIN_PATH;
    steam.search = "";
    return NextResponse.redirect(steam);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
