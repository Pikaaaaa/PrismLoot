/** Public origin for hosted deploys. Never fall back to a hardcoded localhost string in UI copy. */
export function publicSiteUrl(requestOrigin?: string) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  return (requestOrigin ?? "").replace(/\/$/, "");
}
