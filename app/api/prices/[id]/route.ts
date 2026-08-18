import { NextResponse } from "next/server";
import { getSkinPrice, priceUpdatedLabel } from "@/lib/services/prices/priceProvider";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const quote = getSkinPrice(id);
    if (!quote.available) {
      return NextResponse.json({ ok: false, error: "PRICE_UNAVAILABLE", quote }, { status: 404 });
    }
    return NextResponse.json({ ok: true, quote, label: priceUpdatedLabel(quote) });
  } catch {
    return NextResponse.json({ ok: false, error: "PRICE_UNAVAILABLE" }, { status: 404 });
  }
}
