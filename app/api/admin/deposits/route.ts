import { NextResponse } from "next/server";
import { ADMIN_ACTOR_ID, requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { depositDelegate } from "@/lib/db";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistDepositReview, serializeDeposit } from "@/lib/persist/game";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();
  const db = depositDelegate();
  if (!db) {
    return NextResponse.json({ ok: true, pending: 0, deposits: [] });
  }
  try {
    const rows = await db.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { displayName: true } } },
    });
    const pending = await db.count({ where: { status: "PENDING" } });
    return NextResponse.json({
      ok: true,
      pending,
      deposits: rows.map(serializeDeposit),
    });
  } catch (err) {
    console.error("[admin] deposits list failed", err);
    return NextResponse.json({ ok: true, pending: 0, deposits: [] });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = (await req.json()) as { id?: unknown; action?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const raw = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";
    const action = raw === "APPROVE" || raw === "APPROVED" ? "APPROVED" : raw === "REJECT" || raw === "REJECTED" ? "REJECTED" : null;
    if (!id || !action) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const deposit = await persistDepositReview({ id, action, reviewerId: ADMIN_ACTOR_ID });
    await writeAudit({
      action: action === "APPROVED" ? "approve_deposit" : "reject_deposit",
      targetType: "deposit",
      targetId: id,
      detail: `${deposit.asset} ${deposit.amountUsd} USD`,
    });
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    return jsonPlayError(err, "REVIEW_FAILED");
  }
}
