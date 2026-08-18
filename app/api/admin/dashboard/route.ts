import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma, usd } from "@/lib/db";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [users, vaultItems, opensToday, openAgg, recentOpens, recentLedger] = await Promise.all([
    prisma.user.count(),
    prisma.inventoryItem.findMany({
      where: { soldAt: null },
      include: { skin: { select: { priceUsd: true } } },
    }),
    prisma.caseOpen.count({ where: { createdAt: { gte: start } } }),
    prisma.caseOpen.aggregate({
      _sum: { costUsd: true, payoutUsd: true },
      _count: true,
    }),
    prisma.caseOpen.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { displayName: true } },
        case: { select: { name: true } },
        skin: { select: { name: true } },
      },
    }),
    prisma.ledgerEntry.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { displayName: true } } },
    }),
  ]);

  const vaultValue = vaultItems.reduce((sum, row) => sum + row.skin.priceUsd, 0);
  const revenue = openAgg._sum.costUsd ?? 0;
  const payouts = openAgg._sum.payoutUsd ?? 0;

  return NextResponse.json({
    ok: true,
    stats: {
      users,
      vaultValue: usd(vaultValue),
      opensToday,
      opensAll: openAgg._count,
      revenue: usd(revenue),
      payouts: usd(payouts),
      ggr: usd(revenue - payouts),
    },
    recentOpens: recentOpens.map((row) => ({
      id: row.id,
      user: row.user.displayName,
      caseName: row.case.name,
      skinName: row.skin.name,
      costUsd: row.costUsd,
      payoutUsd: row.payoutUsd,
      at: row.createdAt.toISOString(),
    })),
    recentLedger: recentLedger.map((row) => ({
      id: row.id,
      user: row.user.displayName,
      kind: row.kind,
      amountUsd: row.amountUsd,
      note: row.note,
      at: row.createdAt.toISOString(),
    })),
  });
}
