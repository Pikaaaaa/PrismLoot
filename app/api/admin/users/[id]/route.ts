import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { looksLikeTradeUrl, normalizeTradeUrl } from "@/lib/auth/account";
import { prisma, usd, depositDelegate } from "@/lib/db";
import { persistBalanceAdjust, persistGrant, persistItemsLeftVault, persistWagerReset } from "@/lib/persist/game";
import { instantiateSkin } from "@/lib/game";
import { getCatalogItem } from "@/lib/itemCatalog";
import { uid } from "@/lib/utils";
import type { Wear } from "@/lib/types";

const WEARS: Wear[] = ["fn", "mw", "ft", "ww", "bs"];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      bestDrop: { include: { item: { select: { soldAt: true } } } },
      inventory: {
        orderBy: { acquiredAt: "desc" },
        take: 80,
        include: { skin: true },
      },
      ledger: { orderBy: { createdAt: "desc" }, take: 40 },
      caseOpens: { orderBy: { createdAt: "desc" }, take: 20, include: { case: true, skin: true } },
    },
  });
  if (!user) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  let deposits: Array<{
    id: string;
    asset: string;
    network: string;
    amountUsd: number;
    status: string;
    at: string;
  }> = [];
  const depositDb = depositDelegate();
  if (depositDb) {
    try {
      const rows = await depositDb.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      deposits = rows.map((row) => ({
        id: row.id,
        asset: row.asset,
        network: row.network,
        amountUsd: row.amountUsd,
        status: row.status,
        at: row.createdAt.toISOString(),
      }));
    } catch (err) {
      console.error("[admin] user deposits failed", err);
    }
  }

  const vaultValue = user.inventory
    .filter((row) => !row.soldAt)
    .reduce((sum, row) => sum + row.skin.priceUsd, 0);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      displayName: user.displayName,
      steamId: user.steamId,
      email: user.email,
      role: user.role,
      banned: user.banned,
      balanceUsd: usd(user.balanceUsd),
      wagerRemainingUsd: usd(user.wagerRemainingUsd),
      tradeUrl: user.tradeUrl ?? "",
      currency: user.currency,
      createdAt: user.createdAt.toISOString(),
      vaultValue: usd(vaultValue),
      bestDrop: user.bestDrop
        ? {
            name: user.bestDrop.name,
            skinId: user.bestDrop.skinId,
            wear: user.bestDrop.wear,
            priceUsd: user.bestDrop.priceUsd,
            obtainedAt: user.bestDrop.obtainedAt.toISOString(),
            sold: Boolean(user.bestDrop.item.soldAt),
            image: user.bestDrop.image,
          }
        : null,
      inventory: user.inventory.map((row) => ({
        id: row.id,
        skinId: row.skinId,
        name: row.skin.name,
        wear: row.wear,
        rarity: row.skin.rarity,
        source: row.source,
        priceUsd: row.skin.priceUsd,
        acquiredAt: row.acquiredAt.toISOString(),
        soldAt: row.soldAt?.toISOString() ?? null,
        salePriceUsd: row.salePriceUsd,
        image: row.skin.image,
      })),
      ledger: user.ledger.map((row) => ({
        id: row.id,
        kind: row.kind,
        amountUsd: row.amountUsd,
        balanceAfter: row.balanceAfter,
        note: row.note,
        at: row.createdAt.toISOString(),
      })),
      opens: user.caseOpens.map((row) => ({
        id: row.id,
        caseName: row.case.name,
        skinName: row.skin.name,
        costUsd: row.costUsd,
        payoutUsd: row.payoutUsd,
        at: row.createdAt.toISOString(),
      })),
      deposits,
    },
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    balanceDelta?: unknown;
    setBalanceUsd?: unknown;
    reason?: unknown;
    banned?: unknown;
    grantSkinId?: unknown;
    grantWear?: unknown;
    revokeId?: unknown;
    resetWager?: unknown;
    tradeUrl?: unknown;
  };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (typeof body.tradeUrl === "string") {
    const tradeUrl = normalizeTradeUrl(body.tradeUrl);
    if (tradeUrl && !looksLikeTradeUrl(tradeUrl)) {
      return NextResponse.json({ ok: false, error: "TRADE_URL_INVALID" }, { status: 400 });
    }
    await prisma.user.update({ where: { id }, data: { tradeUrl } });
    await writeAudit({
      action: "set_trade_url",
      targetType: "user",
      targetId: id,
      detail: tradeUrl ? "updated" : "cleared",
    });
  }

  if (body.resetWager === true) {
    const result = await persistWagerReset({ userId: id, note: reason });
    await writeAudit({
      action: "reset_wager",
      targetType: "user",
      targetId: id,
      detail: `wager ${result.previousUsd} → 0${reason ? ` · ${reason}` : ""}`,
    });
  }

  if (typeof body.banned === "boolean") {
    await prisma.user.update({ where: { id }, data: { banned: body.banned } });
    await writeAudit({
      action: body.banned ? "ban_user" : "unban_user",
      targetType: "user",
      targetId: id,
      detail: reason,
    });
  }

  const setBalance = Number(body.setBalanceUsd);
  if (Number.isFinite(setBalance)) {
    const delta = usd(setBalance - user.balanceUsd);
    if (delta !== 0) {
      await persistBalanceAdjust({
        userId: id,
        deltaUsd: delta,
        note: reason || `Set balance to ${usd(setBalance)}`,
      });
      await writeAudit({
        action: "set_balance",
        targetType: "user",
        targetId: id,
        detail: `${usd(user.balanceUsd)} → ${usd(setBalance)}${reason ? ` · ${reason}` : ""}`,
      });
    }
  } else {
    const delta = Number(body.balanceDelta);
    if (Number.isFinite(delta) && delta !== 0) {
      await persistBalanceAdjust({
        userId: id,
        deltaUsd: delta,
        note: reason || "Admin balance adjustment",
      });
      await writeAudit({
        action: "adjust_balance",
        targetType: "user",
        targetId: id,
        detail: `${delta > 0 ? "+" : ""}${delta}${reason ? ` · ${reason}` : ""}`,
      });
    }
  }

  const grantSkinId = typeof body.grantSkinId === "string" ? body.grantSkinId.trim() : "";
  if (grantSkinId) {
    const skin = getCatalogItem(grantSkinId);
    if (!skin) return NextResponse.json({ ok: false, error: "SKIN_NOT_FOUND" }, { status: 400 });
    const wearRaw = typeof body.grantWear === "string" ? body.grantWear : skin.wear;
    const wear = WEARS.includes(wearRaw as Wear) ? (wearRaw as Wear) : skin.wear;
    const item = instantiateSkin(skin, { wear, instanceId: uid("adm"), obtainedAt: Date.now() });
    await persistGrant({ userId: id, item, note: `Admin grant ${skin.name}` });
    await writeAudit({
      action: "grant_item",
      targetType: "user",
      targetId: id,
      detail: `${skin.name} (${item.instanceId})`,
    });
  }

  const revokeId = typeof body.revokeId === "string" ? body.revokeId.trim() : "";
  if (revokeId) {
    await persistItemsLeftVault({ userId: id, ids: [revokeId] });
    await writeAudit({
      action: "revoke_item",
      targetType: "inventory",
      targetId: revokeId,
      detail: `user ${id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
