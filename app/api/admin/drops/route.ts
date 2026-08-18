import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take")) || 50));

  const opens = await prisma.caseOpen.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { displayName: true, id: true } },
      case: { select: { name: true } },
      skin: { select: { name: true, rarity: true, image: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    opens: opens.map((row) => ({
      id: row.id,
      userId: row.user.id,
      user: row.user.displayName,
      caseName: row.case.name,
      skinName: row.skin.name,
      rarity: row.skin.rarity,
      image: row.skin.image,
      wear: row.wear,
      costUsd: row.costUsd,
      payoutUsd: row.payoutUsd,
      at: row.createdAt.toISOString(),
    })),
  });
}
