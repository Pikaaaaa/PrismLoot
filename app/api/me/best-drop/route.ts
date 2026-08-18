import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { serializeBestDrop } from "@/lib/persist/game";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ ok: true, bestDrop: null });
    const row = await prisma.bestDrop.findUnique({
      where: { userId },
      include: { item: { select: { soldAt: true } } },
    });
    return NextResponse.json({
      ok: true,
      bestDrop: row ? serializeBestDrop(row) : null,
    });
  } catch (err) {
    console.error("[me] best-drop failed", err);
    return NextResponse.json({ ok: true, bestDrop: null });
  }
}
