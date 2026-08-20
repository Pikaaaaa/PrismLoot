import { NextResponse } from "next/server";
import { allowLocalSession } from "@/lib/auth/local";
import { applySessionCookie } from "@/lib/auth/session";
import { ensureDemoUser } from "@/lib/persist/demo-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!allowLocalSession(req.headers)) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const user = await ensureDemoUser();
    const origin = new URL(req.url).origin;
    const res = NextResponse.redirect(new URL("/profile?auth=local", origin));
    // Loopback is http:// — a Secure cookie would never stick.
    applySessionCookie(res, user.id, { secure: false });
    return res;
  } catch (err) {
    console.error("[auth/local] session failed", err);
    return NextResponse.json({ ok: false, error: "LOCAL_SESSION_FAILED" }, { status: 500 });
  }
}

