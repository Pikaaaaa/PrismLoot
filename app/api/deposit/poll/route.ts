import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { isLiveUsdtTrc20Enabled } from "@/lib/deposits/live";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistDepositPoll } from "@/lib/persist/game";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!isLiveUsdtTrc20Enabled()) {
      return NextResponse.json({ ok: true, live: false, matched: false });
    }
    const result = await persistDepositPoll(userId);
    return NextResponse.json({ live: true, ...result });
  } catch (err) {
    return jsonPlayError(err, "DEPOSIT_POLL_FAILED");
  }
}
