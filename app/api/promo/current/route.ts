import { NextResponse } from "next/server";
import { ensureRotatingPromo, promoRotationEnabled } from "@/lib/promos/rotating";

export async function GET() {
  if (!promoRotationEnabled()) {
    return NextResponse.json({ ok: true, enabled: false });
  }

  try {
    const promo = await ensureRotatingPromo();
    if (!promo) {
      return NextResponse.json({ ok: true, enabled: false });
    }
    return NextResponse.json({
      ok: true,
      enabled: true,
      code: promo.code,
      percentBonus: promo.percentBonus,
      endsAt: promo.endsAt,
    });
  } catch (err) {
    console.error("[promo/current] failed", err);
    return NextResponse.json({ ok: false, error: "PROMO_UNAVAILABLE" }, { status: 503 });
  }
}
