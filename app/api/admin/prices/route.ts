import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { debugPrice, listPriceTable, getPriceHistory } from "@/lib/services/prices/priceProvider";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const skinId = url.searchParams.get("skinId");
  if (skinId) {
    return NextResponse.json({
      ok: true,
      debug: debugPrice(skinId),
      history: getPriceHistory(skinId),
    });
  }
  return NextResponse.json({ ok: true, rows: listPriceTable() });
}
