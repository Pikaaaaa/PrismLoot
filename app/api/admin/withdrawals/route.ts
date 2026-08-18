import { NextResponse } from "next/server";
import { ADMIN_ACTOR_ID, requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { withdrawalDelegate } from "@/lib/db";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistWithdrawalReview, serializeWithdrawal } from "@/lib/persist/game";

function pendingFirst<T extends { status: string; createdAt: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (b.status === "PENDING" && a.status !== "PENDING") return 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();
  const db = withdrawalDelegate();
  if (!db) {
    return NextResponse.json({ ok: true, pending: 0, withdrawals: [] });
  }
  try {
    const rows = await db.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        user: { select: { displayName: true } },
        inventoryItem: true,
      },
    });
    const pending = await db.count({ where: { status: "PENDING" } });
    const withdrawals = pendingFirst(rows.map(serializeWithdrawal));
    return NextResponse.json({
      ok: true,
      pending,
      withdrawals,
    });
  } catch (err) {
    console.error("[admin] withdrawals list failed", err);
    return NextResponse.json({ ok: true, pending: 0, withdrawals: [] });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = (await req.json()) as { id?: unknown; action?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const raw = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";
    const action =
      raw === "APPROVE" || raw === "APPROVED"
        ? "APPROVED"
        : raw === "REJECT" || raw === "REJECTED"
          ? "REJECTED"
          : null;
    if (!id || !action) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const withdrawal = await persistWithdrawalReview({ id, action, reviewerId: ADMIN_ACTOR_ID });
    await writeAudit({
      action: action === "APPROVED" ? "approve_withdrawal" : "reject_withdrawal",
      targetType: "withdrawal",
      targetId: id,
      detail: withdrawal.kind === "SKIN"
        ? `${withdrawal.itemName || "skin"} · ${withdrawal.amountUsd} USD`
        : `${withdrawal.amountUsd} USD`,
    });
    return NextResponse.json({ ok: true, withdrawal });
  } catch (err) {
    return jsonPlayError(err, "REVIEW_FAILED");
  }
}
