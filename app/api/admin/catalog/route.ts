import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { prisma, usd } from "@/lib/db";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") === "skins" ? "skins" : "cases";
  const q = (url.searchParams.get("q") ?? "").trim();

  if (tab === "skins") {
    const skins = await prisma.skin.findMany({
      where: q
        ? { OR: [{ id: { contains: q } }, { name: { contains: q } }, { weapon: { contains: q } }] }
        : undefined,
      orderBy: { name: "asc" },
      take: 80,
    });
    return NextResponse.json({
      ok: true,
      tab,
      skins: skins.map((row) => ({
        id: row.id,
        name: row.name,
        weapon: row.weapon,
        rarity: row.rarity,
        wear: row.wear,
        priceUsd: row.priceUsd,
        enabled: row.enabled,
        image: row.image,
      })),
    });
  }

  const cases = await prisma.case.findMany({
    where: q ? { OR: [{ id: { contains: q } }, { name: { contains: q } }] } : undefined,
    orderBy: { popularity: "desc" },
    include: { _count: { select: { rewards: true, opens: true } } },
  });
  return NextResponse.json({
    ok: true,
    tab,
    cases: cases.map((row) => ({
      id: row.id,
      name: row.name,
      priceUsd: row.priceUsd,
      enabled: row.enabled,
      rtp: row.rtp,
      section: row.section,
      rewards: row._count.rewards,
      opens: row._count.opens,
    })),
  });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json()) as {
    type?: string;
    id?: string;
    priceUsd?: unknown;
    enabled?: unknown;
  };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const price = body.priceUsd == null ? undefined : Number(body.priceUsd);
  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

  if (body.type === "skin") {
    await prisma.skin.update({
      where: { id },
      data: {
        ...(price != null && Number.isFinite(price) ? { priceUsd: usd(price) } : {}),
        ...(enabled != null ? { enabled } : {}),
      },
    });
    await writeAudit({
      action: "edit_skin",
      targetType: "skin",
      targetId: id,
      detail: JSON.stringify({ priceUsd: price, enabled }),
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.case.update({
    where: { id },
    data: {
      ...(price != null && Number.isFinite(price) ? { priceUsd: usd(price) } : {}),
      ...(enabled != null ? { enabled } : {}),
    },
  });
  await writeAudit({
    action: "edit_case",
    targetType: "case",
    targetId: id,
    detail: JSON.stringify({ priceUsd: price, enabled }),
  });
  return NextResponse.json({ ok: true });
}
