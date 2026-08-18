import { NextResponse } from "next/server";
import { DEMO_USER_ID, prisma } from "@/lib/db";
import { serializeBestDrop } from "@/lib/persist/game";

export async function GET() {
  try {
    const row = await prisma.bestDrop.findUnique({
      where: { userId: DEMO_USER_ID },
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
