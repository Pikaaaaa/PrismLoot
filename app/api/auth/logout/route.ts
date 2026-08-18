import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { publicSiteOrigin } from "@/lib/auth/site";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", publicSiteOrigin(req)));
  clearSessionCookie(res);
  return res;
}
