/** Public origin for Steam OpenID realm / return_to. Never a trailing slash. */
export function publicSiteOrigin(req: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");

  return new URL(req.url).origin;
}
