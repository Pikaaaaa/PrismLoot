import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistAccountEmail } from "@/lib/persist/game";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email : "";
    const result = await persistAccountEmail({ userId, email });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonPlayError(err, "PERSIST_FAILED");
  }
}
