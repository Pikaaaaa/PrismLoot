import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_USER_ID } from "@/lib/db";

const COOKIE = "pl_gate";
const HMAC_COMPARE_KEY = "pl-gate-cmp";

export function adminSecret() {
  return process.env.ADMIN_SECRET ?? "";
}

function sessionToken() {
  const secret = adminSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update("pl-gate-session").digest("hex");
}

function hmacEqual(a: string, b: string) {
  const left = createHmac("sha256", HMAC_COMPARE_KEY).update(a).digest();
  const right = createHmac("sha256", HMAC_COMPARE_KEY).update(b).digest();
  return timingSafeEqual(left, right);
}

export function passwordMatches(password: string) {
  const secret = adminSecret();
  if (!secret) {
    hmacEqual(password, "\0");
    return false;
  }
  return hmacEqual(password, secret);
}

export async function isAdminAuthed() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const expected = sessionToken();
  if (!token || !expected) return false;
  return hmacEqual(token, expected);
}

export async function setAdminSession() {
  const token = sessionToken();
  if (!token) return;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete("prismloot_admin");
}

export function adminNotFound() {
  return new NextResponse("Not Found", { status: 404 });
}

export async function requireAdmin() {
  if (await isAdminAuthed()) return null;
  return adminNotFound();
}

export const ADMIN_ACTOR_ID = ADMIN_USER_ID;
