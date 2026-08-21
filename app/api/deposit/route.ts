import { NextResponse } from "next/server";
import { getSessionUserId, requireUserId } from "@/lib/auth/session";
import { depositDelegate } from "@/lib/db";
import { publicDepositCatalog } from "@/lib/deposits/catalog";
import { isAnyLiveDepositEnabled } from "@/lib/deposits/live";
import { jsonPlayError } from "@/lib/persist/errors";
import { loadPlayerSnapshot, persistDepositCreate, serializeDeposit } from "@/lib/persist/game";

export async function GET() {
  const catalog = publicDepositCatalog();
  let banned = false;
  let balance = 0;
  const userId = await getSessionUserId();

  if (userId) {
    try {
      const snapshot = await loadPlayerSnapshot(userId);
      banned = snapshot.banned;
      balance = snapshot.balance;
    } catch (err) {
      console.error("[deposit] snapshot failed", err);
    }
  }

  let deposits: ReturnType<typeof serializeDeposit>[] = [];
  const db = depositDelegate();
  if (db && userId) {
    try {
      const rows = await db.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 40,
      });
      deposits = rows.map(serializeDeposit);
    } catch (err) {
      console.error("[deposit] list failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    live: isAnyLiveDepositEnabled(),
    banned,
    catalog,
    deposits,
    ...(userId ? { balance } : {}),
  });
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as {
      asset?: unknown;
      network?: unknown;
      amountUsd?: unknown;
      txNote?: unknown;
      promoCode?: unknown;
    };
    const asset = typeof body.asset === "string" ? body.asset.trim().toUpperCase() : "";
    const network = typeof body.network === "string" ? body.network.trim().toLowerCase() : "";
    const amountUsd = Number(body.amountUsd);
    const txNote = typeof body.txNote === "string" ? body.txNote : "";
    const promoCode = typeof body.promoCode === "string" ? body.promoCode : "";
    if (!asset || !network || !Number.isFinite(amountUsd)) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const deposit = await persistDepositCreate({ userId, asset, network, amountUsd, txNote, promoCode });
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    return jsonPlayError(err, "DEPOSIT_FAILED");
  }
}
