import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const PLAYER_SESSION_COOKIE = "pl_uid";
export const STEAM_NONCE_COOKIE = "pl_oid_n";

const HMAC_COMPARE_KEY = "pl-uid-cmp";

function sessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim() || process.env.ADMIN_SECRET?.trim() || "";
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET_MISSING");
  }
  return "local-dev-pl-session";
}

function hmacEqual(a: string, b: string) {
  const left = createHmac("sha256", HMAC_COMPARE_KEY).update(a).digest();
  const right = createHmac("sha256", HMAC_COMPARE_KEY).update(b).digest();
  return timingSafeEqual(left, right);
}

function signUserId(userId: string) {
  const mac = createHmac("sha256", sessionSecret()).update(userId).digest("hex");
  return `${mac}.${userId}`;
}

function readSignedUserId(value: string | undefined) {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot < 1) return null;
  const mac = value.slice(0, dot);
  const userId = value.slice(dot + 1);
  if (!userId || userId.length > 80) return null;
  const expected = createHmac("sha256", sessionSecret()).update(userId).digest("hex");
  if (!hmacEqual(mac, expected)) return null;
  return userId;
}

function cookieBase() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export function applySessionCookie(res: NextResponse, userId: string) {
  res.cookies.set(PLAYER_SESSION_COOKIE, signUserId(userId), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function applyNonceCookie(res: NextResponse, nonce: string) {
  res.cookies.set(STEAM_NONCE_COOKIE, nonce, {
    ...cookieBase(),
    maxAge: 60 * 10,
  });
}

export function clearNonceCookie(res: NextResponse) {
  res.cookies.delete(STEAM_NONCE_COOKIE);
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.delete(PLAYER_SESSION_COOKIE);
  res.cookies.delete(STEAM_NONCE_COOKIE);
}

export async function getSessionUserId() {
  try {
    const jar = await cookies();
    return readSignedUserId(jar.get(PLAYER_SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function readSteamNonce() {
  try {
    const jar = await cookies();
    return jar.get(STEAM_NONCE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function requireUserId() {
  const id = await getSessionUserId();
  if (!id) throw new Error("AUTH_REQUIRED");
  return id;
}
