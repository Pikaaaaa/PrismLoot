import { NextResponse } from "next/server";
import { listPriceTable, getSkinPrices } from "@/lib/services/prices/priceProvider";
import { SKINS } from "@/data/skins";

export async function GET() {
  const ids = SKINS.map((s) => s.id);
  return NextResponse.json({
    ok: true,
    quotes: getSkinPrices(ids),
    table: listPriceTable(),
  });
}
