/** Public URL prefix for the operator console (no trailing slash). */
const DEFAULT_ADMIN_PATH = "/pl-console-9f3k";

/** Filesystem route used after proxy rewrite. Not a public URL. */
export const INTERNAL_CONSOLE_PATH = "/xopl";

/** Request header set by proxy.ts so public chrome can hide without leaking the path. */
export const CONSOLE_REQUEST_HEADER = "x-pl-console";
export const CONSOLE_REST_HEADER = "x-pl-console-rest";

export function getAdminBasePath() {
  const raw = process.env.ADMIN_PATH?.trim() || DEFAULT_ADMIN_PATH;
  let path = raw.startsWith("/") ? raw : `/${raw}`;
  path = path.replace(/\/+$/, "");
  if (!path || path === "/" || path === "/admin") {
    return DEFAULT_ADMIN_PATH;
  }
  return path;
}

export function isAdminBasePath(pathname: string) {
  const base = getAdminBasePath();
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isInternalConsolePath(pathname: string) {
  return pathname === INTERNAL_CONSOLE_PATH || pathname.startsWith(`${INTERNAL_CONSOLE_PATH}/`);
}

export function rewriteAdminToInternal(pathname: string) {
  const base = getAdminBasePath();
  if (pathname === base) return INTERNAL_CONSOLE_PATH;
  if (pathname.startsWith(`${base}/`)) {
    return `${INTERNAL_CONSOLE_PATH}/${pathname.slice(base.length + 1)}`;
  }
  return pathname;
}

export function consoleHref(base: string, subpath = "") {
  if (!subpath || subpath === "/") return base;
  return `${base}${subpath.startsWith("/") ? subpath : `/${subpath}`}`;
}

/** Path after the console base, e.g. "" | "/login" | "/users". */
export function consoleRest(pathname: string, base: string) {
  if (pathname === base || pathname === INTERNAL_CONSOLE_PATH || pathname === "/admin") return "";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  if (pathname.startsWith(`${INTERNAL_CONSOLE_PATH}/`)) {
    return pathname.slice(INTERNAL_CONSOLE_PATH.length);
  }
  if (pathname.startsWith("/admin/")) return pathname.slice("/admin".length);
  return pathname;
}
