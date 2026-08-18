import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return NextResponse.json({
    ok: true,
    promos: promos.map((row) => ({
      id: row.id,
      code: row.code,
      percentBonus: row.percentBonus,
      enabled: row.enabled,
      maxRedemptions: row.maxRedemptions,
      note: row.note,
      redemptions: row._count.redemptions,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json()) as {
    code?: string;
    percentBonus?: unknown;
    note?: string;
    enabled?: unknown;
  };
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
  const percent = Number(body.percentBonus);
  const promo = await prisma.promoCode.create({
    data: {
      code,
      percentBonus: Number.isFinite(percent) ? Math.round(percent) : 20,
      note: typeof body.note === "string" ? body.note : "",
      enabled: body.enabled !== false,
    },
  });
  await writeAudit({ action: "create_promo", targetType: "promo", targetId: promo.id, detail: code });
  return NextResponse.json({ ok: true, id: promo.id });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json()) as { id?: string; enabled?: unknown; percentBonus?: unknown; note?: string };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await prisma.promoCode.update({
    where: { id },
    data: {
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(Number.isFinite(Number(body.percentBonus)) ? { percentBonus: Math.round(Number(body.percentBonus)) } : {}),
      ...(typeof body.note === "string" ? { note: body.note } : {}),
    },
  });
  await writeAudit({ action: "edit_promo", targetType: "promo", targetId: id });
  return NextResponse.json({ ok: true });
}
