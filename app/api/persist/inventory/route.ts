import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistItemsLeftVault } from "@/lib/persist/game";
import type { InventoryLeftVia } from "@/lib/types";

function parseLeftVia(value: unknown): InventoryLeftVia | undefined {
  if (value === "sell" || value === "upgrade" || value === "contract" || value === "withdraw") return value;
  return undefined;
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as { ids?: unknown; sales?: unknown; leftVia?: unknown };
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
    await persistItemsLeftVault({ userId, ids, sales, leftVia: parseLeftVia(body.leftVia) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonPlayError(err, "PERSIST_FAILED");
  }
}
