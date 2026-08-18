import { NextResponse } from "next/server";
import { getSessionUserId, requireUserId } from "@/lib/auth/session";
import { prisma, withdrawalDelegate } from "@/lib/db";
import { jsonPlayError } from "@/lib/persist/errors";
import {
  loadPlayerSnapshot,
  persistSkinWithdrawalCreate,
  serializeWithdrawal,
} from "@/lib/persist/game";

const WITHDRAWAL_INCLUDE = { inventoryItem: true };

export async function GET() {
  let banned = false;
  let wagerRemainingUsd = 0;
  const userId = await getSessionUserId();

  if (userId) {
    try {
      const snapshot = await loadPlayerSnapshot(userId);
      banned = snapshot.banned;
      wagerRemainingUsd = snapshot.wagerRemainingUsd;
    } catch (err) {
      console.error("[withdraw] snapshot failed", err);
    }
  }

  let withdrawals: ReturnType<typeof serializeWithdrawal>[] = [];
  let pending = 0;
  const db = withdrawalDelegate();
  if (userId) {
    try {
      if (db) {
        const rows = await db.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 40,
          include: WITHDRAWAL_INCLUDE,
        });
        withdrawals = rows.map(serializeWithdrawal);
      } else {
        const rows = await prisma.$queryRaw<
          Array<{
            id: string;
            userId: string;
            amountUsd: number;
            status: string;
            kind: string | null;
            inventoryItemId: string | null;
            itemName: string | null;
            tradeUrl: string | null;
            note: string;
            createdAt: Date | string;
            reviewedAt: Date | string | null;
          }>
        >`SELECT * FROM Withdrawal WHERE userId = ${userId} ORDER BY createdAt DESC LIMIT 40`;
        withdrawals = rows.map((row) => serializeWithdrawal(row));
      }
      pending = withdrawals.filter((row) => row.status === "PENDING").length;
    } catch (err) {
      console.error("[withdraw] list failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    banned,
    wagerRemainingUsd,
    pending,
    withdrawals,
  });
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as { instanceId?: unknown; tradeUrl?: unknown };
    const instanceId = typeof body.instanceId === "string" ? body.instanceId.trim() : "";
    if (!instanceId) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT", message: "Не выбран скин." },
        { status: 400 },
      );
    }
    const tradeUrl = typeof body.tradeUrl === "string" ? body.tradeUrl : undefined;
    const result = await persistSkinWithdrawalCreate({ userId, instanceId, tradeUrl });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[withdraw] create failed", err);
    return jsonPlayError(err, "WITHDRAW_FAILED");
  }
}
