import { NextResponse } from "next/server";
import { loadDemoSnapshot } from "@/lib/persist/game";

export async function GET() {
  try {
    const snapshot = await loadDemoSnapshot();
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    console.error("[me] snapshot failed", err);
    return NextResponse.json({ ok: false, error: "ME_FAILED" }, { status: 500 });
  }
}
