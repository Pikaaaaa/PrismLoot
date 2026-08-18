import { NextResponse } from "next/server";
import { refreshSkinPrice, getSkinPrice, priceUpdatedLabel, applyLiveQuote } from "@/lib/services/prices/priceProvider";
import { fetchLiveQuote } from "@/lib/services/prices/live";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { skinId?: string; live?: boolean };
    const skinId = body.skinId?.trim();
    if (!skinId) {
      return NextResponse.json({ ok: false, error: "skinId required" }, { status: 400 });
    }
    if (body.live) {
      try {
        const live = await fetchLiveQuote(skinId);
        applyLiveQuote(live);
        return NextResponse.json({ ok: true, quote: live, live: true });
      } catch {
        const quote = getSkinPrice(skinId);
        return NextResponse.json({
          ok: true,
          quote,
          live: false,
          label: priceUpdatedLabel(quote),
          note: "Live market unavailable — last snapshot kept",
        });
      }
    }
    const quote = await refreshSkinPrice(skinId);
    return NextResponse.json({ ok: true, quote, label: priceUpdatedLabel(quote) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SYNC_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
