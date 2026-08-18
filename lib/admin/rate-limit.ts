type Bucket = { fails: number; blockedUntil: number };

const byIp = new Map<string, Bucket>();
let globalFails = 0;
let globalBlockedUntil = 0;

const MIN_DELAY_MS = 650;
const IP_MAX_FAILS = 8;
const IP_LOCK_MS = 15 * 60 * 1000;
const GLOBAL_MAX_FAILS = 40;
const GLOBAL_LOCK_MS = 5 * 60 * 1000;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function isLoginBlocked(ip: string) {
  const now = Date.now();
  if (now < globalBlockedUntil) return true;
  const bucket = byIp.get(ip);
  return Boolean(bucket && now < bucket.blockedUntil);
}

export async function padLoginTiming(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_DELAY_MS) {
    await delay(MIN_DELAY_MS - elapsed);
  }
}

export function registerLoginFailure(ip: string) {
  const now = Date.now();
  const bucket = byIp.get(ip) ?? { fails: 0, blockedUntil: 0 };
  bucket.fails += 1;
  if (bucket.fails >= IP_MAX_FAILS) {
    bucket.blockedUntil = now + IP_LOCK_MS;
    bucket.fails = 0;
  }
  byIp.set(ip, bucket);

  globalFails += 1;
  if (globalFails >= GLOBAL_MAX_FAILS) {
    globalBlockedUntil = now + GLOBAL_LOCK_MS;
    globalFails = 0;
  }
}

export function registerLoginSuccess(ip: string) {
  byIp.delete(ip);
}
