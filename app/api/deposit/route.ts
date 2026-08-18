import { NextResponse } from "next/server";
import { depositDelegate } from "@/lib/db";
import { publicDepositCatalog } from "@/lib/deposits/catalog";
import { jsonPlayError } from "@/lib/persist/errors";
import { loadDemoSnapshot, persistDepositCreate, serializeDeposit } from "@/lib/persist/game";

export async function GET() {
  const catalog = publicDepositCatalog();
  let banned = false;
  let balance = 0;
  let userId: string | null = null;
  try {
    const snapshot = await loadDemoSnapshot();
    banned = snapshot.banned;
    balance = snapshot.balance;
    userId = snapshot.user.id;
  } catch (err) {
    console.error("[deposit] snapshot failed", err);
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
    banned,
    balance,
    catalog,
    deposits,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      asset?: unknown;
      network?: unknown;
      amountUsd?: unknown;
      txNote?: unknown;
    };
    const asset = typeof body.asset === "string" ? body.asset.trim().toUpperCase() : "";
    const network = typeof body.network === "string" ? body.network.trim().toLowerCase() : "";
    const amountUsd = Number(body.amountUsd);
    const txNote = typeof body.txNote === "string" ? body.txNote : "";
    if (!asset || !network || !Number.isFinite(amountUsd)) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const deposit = await persistDepositCreate({ asset, network, amountUsd, txNote });
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    return jsonPlayError(err, "DEPOSIT_FAILED");
  }
}
