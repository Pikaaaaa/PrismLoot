import { NextResponse } from "next/server";
import { adminNotFound, passwordMatches, setAdminSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import {
  clientIp,
  isLoginBlocked,
  padLoginTiming,
  registerLoginFailure,
  registerLoginSuccess,
} from "@/lib/admin/rate-limit";

const INVALID = { ok: false, error: "Invalid credentials" } as const;

export async function GET() {
  return adminNotFound();
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const ip = clientIp(req);

  try {
    if (isLoginBlocked(ip)) {
      await padLoginTiming(startedAt);
      return NextResponse.json(INVALID, { status: 401 });
    }

    const body = (await req.json()) as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";
    if (!passwordMatches(password)) {
      registerLoginFailure(ip);
      await padLoginTiming(startedAt);
      return NextResponse.json(INVALID, { status: 401 });
    }

    await setAdminSession();
    registerLoginSuccess(ip);
    await writeAudit({ action: "login", detail: "Session started" }).catch(() => undefined);
    await padLoginTiming(startedAt);
    return NextResponse.json({ ok: true });
  } catch {
    registerLoginFailure(ip);
    await padLoginTiming(startedAt);
    return NextResponse.json(INVALID, { status: 401 });
  }
}
