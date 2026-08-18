import { NextResponse } from "next/server";
import { ADMIN_ACTOR_ID, requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { clampWagerMultiplier } from "@/lib/gift-cards/wager";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistGiftCardDisable, persistGiftCardsCreate, serializeGiftCard } from "@/lib/persist/game";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();
  try {
    const rows = await prisma.giftCard.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { redeemedBy: { select: { displayName: true } } },
    });
    return NextResponse.json({ ok: true, cards: rows.map(serializeGiftCard) });
  } catch (err) {
    console.error("[admin] gift cards list failed", err);
    return NextResponse.json({ ok: true, cards: [] });
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
      return NextResponse.json({ ok: false, error: "INVALID_INPUT", message: "Check amount, quantity and expiry, then try again." }, { status: 400 });
    }
    const wagerMultiplier = clampWagerMultiplier(body.wagerMultiplier);
    const cards = await persistGiftCardsCreate({
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
    });
    return NextResponse.json({ ok: true, cards });
  } catch (err) {
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
    const card = await persistGiftCardDisable(id);
    await writeAudit({
      action: "disable_gift_card",
      targetType: "gift_card",
      targetId: id,
      detail: card.code,
    });
    return NextResponse.json({ ok: true, card });
  } catch (err) {
    return jsonPlayError(err, "DISABLE_FAILED");
  }
}
