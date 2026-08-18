import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const rows = await prisma.adminAuditLog.findMany({
    take: 80,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { displayName: true } } },
  });
  return NextResponse.json({
    ok: true,
    logs: rows.map((row) => ({
      id: row.id,
      actor: row.actor?.displayName ?? "system",
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      detail: row.detail,
      at: row.createdAt.toISOString(),
    })),
  });
}
