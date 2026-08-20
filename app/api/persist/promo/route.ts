import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistPromoRedeem } from "@/lib/persist/game";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as { code?: string };
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
    const result = await persistPromoRedeem({ userId, code });
    if (!result.ok) throw new Error("PROMO_INVALID");
    return NextResponse.json({ ok: true, code, already: result.already });
  } catch (err) {
    return jsonPlayError(err, "PERSIST_FAILED");
  }
}
