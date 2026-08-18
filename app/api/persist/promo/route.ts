import { NextResponse } from "next/server";
import { persistPromoRedeem } from "@/lib/persist/game";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: string };
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
    const result = await persistPromoRedeem({ code });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, already: result.already });
  } catch (err) {
    console.error("[persist] promo failed", err);
    return NextResponse.json({ ok: false, error: "PERSIST_FAILED" }, { status: 500 });
  }
}
