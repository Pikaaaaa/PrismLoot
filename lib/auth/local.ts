/** Localhost-only session bypass. Never a production guest / NovaPrime hydrate. */

export const LOCAL_PLAY_PATH = "/api/auth/local";

export function hostnameFromHostHeader(hostHeader: string) {
  const raw = hostHeader.split(",")[0].trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end > 0 ? raw.slice(1, end) : raw;
  }
  const colon = raw.lastIndexOf(":");
  if (colon > 0 && /^\d+$/.test(raw.slice(colon + 1))) return raw.slice(0, colon);
  return raw;
}

export function isLoopbackHostname(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function requestHostname(headers: Headers) {
  // Do not trust x-forwarded-host here — it is trivial to spoof on a misconfigured proxy.
  return hostnameFromHostHeader(headers.get("host") || "");
}

/**
 * Session cookie for the seeded demo user is allowed only on loopback, or on a
 * non-Vercel `next dev` process. `VERCEL` set (preview/prod) always denies.
 * Do not gate this on a public env flag — that can be flipped on Vercel by mistake.
 */
export function allowLocalSession(headers: Headers) {
  if (process.env.VERCEL) return false;

  const host = requestHostname(headers);
  if (host === "prismloot.biz" || host === "www.prismloot.biz") return false;
  if (isLoopbackHostname(host)) return true;

  return process.env.NODE_ENV === "development";
}
