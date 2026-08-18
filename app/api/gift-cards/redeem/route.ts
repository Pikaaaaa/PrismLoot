import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/admin/audit";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistGiftCardRedeem } from "@/lib/persist/game";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code : "";
    const result = await persistGiftCardRedeem({ code });
    await writeAudit({
      action: "redeem_gift_card",
      targetType: "gift_card",
      targetId: result.card.id,
      detail: `${result.card.code} +${result.amountUsd} USD`,
      actorId: result.card.redeemedByUserId,
    });
    return NextResponse.json({
      ok: true,
      amountUsd: result.amountUsd,
      balance: result.balance,
      code: result.card.code,
      wagerMultiplier: result.wagerMultiplier,
      wagerAddedUsd: result.wagerAddedUsd,
      wagerRemainingUsd: result.wagerRemainingUsd,
    });
  } catch (err) {
    return jsonPlayError(err, "GIFT_CARD_INVALID");
  }
}
