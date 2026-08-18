import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma, usd } from "@/lib/db";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(80, Math.max(1, Number(url.searchParams.get("take")) || 40));

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { id: { contains: q } },
            { displayName: { contains: q } },
            { steamId: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      _count: { select: { inventory: true, caseOpens: true } },
      bestDrop: true,
    },
  });

  return NextResponse.json({
    ok: true,
    users: users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      steamId: user.steamId,
      role: user.role,
      banned: user.banned,
      balanceUsd: usd(user.balanceUsd),
      currency: user.currency,
      createdAt: user.createdAt.toISOString(),
      vaultCount: user._count.inventory,
      opens: user._count.caseOpens,
      bestDrop: user.bestDrop
        ? { name: user.bestDrop.name, priceUsd: user.bestDrop.priceUsd }
        : null,
    })),
  });
}
