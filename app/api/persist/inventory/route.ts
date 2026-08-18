import { NextResponse } from "next/server";
import { persistItemsLeftVault } from "@/lib/persist/game";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { ids?: unknown; sales?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id)).filter(Boolean) : [];
    if (!ids.length) {
      return NextResponse.json({ ok: false, error: "ids required" }, { status: 400 });
    }
    const sales: Record<string, number> = {};
    if (body.sales && typeof body.sales === "object" && !Array.isArray(body.sales)) {
      for (const [key, value] of Object.entries(body.sales as Record<string, unknown>)) {
        const n = Number(value);
        if (Number.isFinite(n)) sales[key] = n;
      }
    }
    await persistItemsLeftVault({ ids, sales });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[persist] inventory leave failed", err);
    return NextResponse.json({ ok: false, error: "PERSIST_FAILED" }, { status: 500 });
  }
}
