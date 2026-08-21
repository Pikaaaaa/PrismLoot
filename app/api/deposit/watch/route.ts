import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { isLiveUsdtTrc20Enabled } from "@/lib/deposits/live";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistDepositWatch } from "@/lib/persist/game";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!isLiveUsdtTrc20Enabled()) {
      return NextResponse.json({ ok: false, error: "DEPOSIT_UNAVAILABLE" }, { status: 503 });
    }
    const body = (await req.json()) as { amountUsd?: unknown; promoCode?: unknown };
    const amountUsd = Number(body.amountUsd);
    const promoCode = typeof body.promoCode === "string" ? body.promoCode : "";
    if (!Number.isFinite(amountUsd)) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const deposit = await persistDepositWatch({ userId, amountUsd, promoCode });
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    return jsonPlayError(err, "DEPOSIT_WATCH_FAILED");
  }
}
