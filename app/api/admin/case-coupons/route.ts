import { NextResponse } from "next/server";
import { ADMIN_ACTOR_ID, requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { CASES } from "@/data/cases";
import { createCaseCoupons, disableCaseCoupon, listCaseCoupons } from "@/lib/case-coupons/store";
import { prisma } from "@/lib/db";
import { jsonPlayError, prismaErrorCode } from "@/lib/persist/errors";
import { ensurePlayCatalog } from "@/lib/persist/game";

function catalogCases() {
  return [...CASES]
    .map((row) => ({ id: row.id, name: row.name, priceUsd: row.price }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const coupons = await listCaseCoupons();
    return NextResponse.json({ ok: true, coupons, catalog: catalogCases() });
  } catch (err) {
    console.error("[admin] case coupons list failed", {
      prismaCode: prismaErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return jsonPlayError(err, "CASE_COUPON_UNAVAILABLE");
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = (await req.json()) as {
      caseId?: unknown;
      code?: unknown;
      maxUses?: unknown;
      opensPerRedeem?: unknown;
      quantity?: unknown;
      note?: unknown;
      expiresAt?: unknown;
    };
    const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
    if (!caseId) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT", message: "Pick a case, then try again." },
        { status: 400 },
      );
    }
    const expiresRaw = typeof body.expiresAt === "string" ? body.expiresAt.trim() : "";
    const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT", message: "Check the form and try again." },
        { status: 400 },
      );
    }
    await ensurePlayCatalog(prisma, { caseId, items: [] });
    const coupons = await createCaseCoupons({
      caseId,
      code: typeof body.code === "string" ? body.code : "",
      maxUses: Number(body.maxUses ?? 1),
      opensPerRedeem: Number(body.opensPerRedeem ?? 1),
      quantity: Number(body.quantity ?? 1),
      note: typeof body.note === "string" ? body.note : "",
      expiresAt,
      createdBy: ADMIN_ACTOR_ID,
    });
    await writeAudit({
      action: "create_case_coupon",
      targetType: "case_coupon",
      targetId: coupons.map((row) => row.id).join(","),
      detail: `${coupons.length}× ${coupons[0]?.code ?? ""} · ${caseId}`,
    }).catch((err) => {
      console.error("[admin] case coupon audit failed", err);
    });
    return NextResponse.json({ ok: true, coupons });
  } catch (err) {
    console.error("[admin] case coupon create failed", {
      prismaCode: prismaErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return jsonPlayError(err, "CASE_COUPON_CREATE_FAILED");
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
    const coupon = await disableCaseCoupon(id);
    await writeAudit({
      action: "disable_case_coupon",
      targetType: "case_coupon",
      targetId: id,
      detail: coupon.code,
    }).catch((err) => {
      console.error("[admin] case coupon audit failed", err);
    });
    return NextResponse.json({ ok: true, coupon });
  } catch (err) {
    console.error("[admin] case coupon disable failed", {
      prismaCode: prismaErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return jsonPlayError(err, "CASE_COUPON_DISABLE_FAILED");
  }
}
