import { NextResponse } from "next/server";
import { ADMIN_ACTOR_ID, requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { clampWagerMultiplier } from "@/lib/gift-cards/wager";
import { createGiftCards, disableGiftCard, listGiftCards } from "@/lib/gift-cards/store";
import { jsonPlayError, prismaErrorCode } from "@/lib/persist/errors";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();
  try {
    const cards = await listGiftCards(status);
    return NextResponse.json({ ok: true, cards });
  } catch (err) {
    console.error("[admin] gift cards list failed", {
      prismaCode: prismaErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return jsonPlayError(err, "GIFT_CARD_UNAVAILABLE");
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = (await req.json()) as {
      amountUsd?: unknown;
      quantity?: unknown;
      note?: unknown;
      expiresAt?: unknown;
      wagerMultiplier?: unknown;
    };
    const amountUsd = Number(body.amountUsd);
    const quantity = Number(body.quantity ?? 1);
    const note = typeof body.note === "string" ? body.note : "";
    const expiresRaw = typeof body.expiresAt === "string" ? body.expiresAt.trim() : "";
    const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT", message: "Check amount, quantity and expiry, then try again." },
        { status: 400 },
      );
    }
    const wagerMultiplier = clampWagerMultiplier(body.wagerMultiplier);
    const cards = await createGiftCards({
      amountUsd,
      quantity,
      note,
      expiresAt,
      createdBy: ADMIN_ACTOR_ID,
      wagerMultiplier,
    });
    await writeAudit({
      action: "create_gift_card",
      targetType: "gift_card",
      targetId: cards.map((row) => row.id).join(","),
      detail: `${cards.length}× ${cards[0]?.amountUsd ?? amountUsd} USD · x${wagerMultiplier}`,
    }).catch((err) => {
      console.error("[admin] gift card audit failed", err);
    });
    return NextResponse.json({ ok: true, cards });
  } catch (err) {
    console.error("[admin] gift card create failed", {
      prismaCode: prismaErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return jsonPlayError(err, "CREATE_FAILED");
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = (await req.json()) as { id?: unknown; action?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";
    if (!id || action !== "DISABLE") {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT", message: "Check the form and try again." },
        { status: 400 },
      );
    }
    const card = await disableGiftCard(id);
    await writeAudit({
      action: "disable_gift_card",
      targetType: "gift_card",
      targetId: id,
      detail: card.code,
    }).catch((err) => {
      console.error("[admin] gift card audit failed", err);
    });
    return NextResponse.json({ ok: true, card });
  } catch (err) {
    console.error("[admin] gift card disable failed", {
      prismaCode: prismaErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return jsonPlayError(err, "DISABLE_FAILED");
  }
}
