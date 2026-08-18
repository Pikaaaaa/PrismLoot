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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
