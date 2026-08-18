import { randomUUID } from "node:crypto";
import { prisma, usd } from "@/lib/db";
import { generateGiftCode } from "@/lib/gift-cards/codes";
import { readyGiftCardDelegate, withGiftCardSchema } from "@/lib/gift-cards/ensure";
import { clampWagerMultiplier } from "@/lib/gift-cards/wager";

type GiftCardRecord = {
  id: string;
  code: string;
  amountUsd: number;
  status: string;
  createdBy: string;
  createdAt: Date | string;
  expiresAt: Date | string | null;
  redeemedByUserId: string | null;
  redeemedAt: Date | string | null;
  note: string;
  wagerMultiplier?: number | null;
  redeemedBy?: { displayName: string } | null;
  redeemedByName?: string | null;
};

export type SerializedGiftCard = {
  id: string;
  code: string;
  amountUsd: number;
  status: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  redeemedByUserId: string | null;
  redeemedBy: string | null;
  redeemedAt: string | null;
  note: string;
  wagerMultiplier: number;
};

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeGiftCardRow(row: GiftCardRecord): SerializedGiftCard {
  const wagerMultiplier = clampWagerMultiplier(row.wagerMultiplier ?? 10);
  return {
    id: row.id,
    code: row.code,
    amountUsd: usd(Number(row.amountUsd)),
    status: row.status,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    expiresAt: iso(row.expiresAt),
    redeemedByUserId: row.redeemedByUserId,
    redeemedBy: row.redeemedBy?.displayName ?? row.redeemedByName ?? null,
    redeemedAt: iso(row.redeemedAt),
    note: row.note ?? "",
    wagerMultiplier,
  };
}

async function listRaw(status: string): Promise<GiftCardRecord[]> {
  if (status) {
    return prisma.$queryRaw<GiftCardRecord[]>`
      SELECT
        g."id", g."code", g."amountUsd", g."status", g."createdBy", g."createdAt",
        g."expiresAt", g."redeemedByUserId", g."redeemedAt", g."note", g."wagerMultiplier",
        u."displayName" AS "redeemedByName"
      FROM "GiftCard" g
      LEFT JOIN "User" u ON u."id" = g."redeemedByUserId"
      WHERE g."status" = ${status}
      ORDER BY g."createdAt" DESC
      LIMIT 200
    `;
  }
  return prisma.$queryRaw<GiftCardRecord[]>`
    SELECT
      g."id", g."code", g."amountUsd", g."status", g."createdBy", g."createdAt",
      g."expiresAt", g."redeemedByUserId", g."redeemedAt", g."note", g."wagerMultiplier",
      u."displayName" AS "redeemedByName"
    FROM "GiftCard" g
    LEFT JOIN "User" u ON u."id" = g."redeemedByUserId"
    ORDER BY g."createdAt" DESC
    LIMIT 200
  `;
}

async function findByCodeRaw(code: string) {
  const rows = await prisma.$queryRaw<GiftCardRecord[]>`
    SELECT * FROM "GiftCard" WHERE "code" = ${code} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findByIdRaw(id: string) {
  const rows = await prisma.$queryRaw<GiftCardRecord[]>`
    SELECT
      g."id", g."code", g."amountUsd", g."status", g."createdBy", g."createdAt",
      g."expiresAt", g."redeemedByUserId", g."redeemedAt", g."note", g."wagerMultiplier",
      u."displayName" AS "redeemedByName"
    FROM "GiftCard" g
    LEFT JOIN "User" u ON u."id" = g."redeemedByUserId"
    WHERE g."id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function insertRaw(input: {
  code: string;
  amountUsd: number;
  createdBy: string;
  expiresAt: Date | null;
  note: string;
  wagerMultiplier: number;
}) {
  const id = randomUUID();
  const createdAt = new Date();
  await prisma.$executeRaw`
    INSERT INTO "GiftCard" (
      "id", "code", "amountUsd", "status", "wagerMultiplier", "createdBy",
      "createdAt", "expiresAt", "redeemedByUserId", "redeemedAt", "note"
    ) VALUES (
      ${id}, ${input.code}, ${input.amountUsd}, ${"UNUSED"}, ${input.wagerMultiplier},
      ${input.createdBy}, ${createdAt}, ${input.expiresAt}, ${null}, ${null}, ${input.note}
    )
  `;
  return (
    (await findByIdRaw(id)) ?? {
      id,
      code: input.code,
      amountUsd: input.amountUsd,
      status: "UNUSED",
      createdBy: input.createdBy,
      createdAt,
      expiresAt: input.expiresAt,
      redeemedByUserId: null,
      redeemedAt: null,
      note: input.note,
      wagerMultiplier: input.wagerMultiplier,
    }
  );
}

export async function listGiftCards(status?: string) {
  const filter = (status ?? "").trim().toUpperCase();
  return withGiftCardSchema(async () => {
    const db = await readyGiftCardDelegate();
    if (db) {
      const rows = (await db.findMany({
        where: filter ? { status: filter } : undefined,
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { redeemedBy: { select: { displayName: true } } },
      })) as GiftCardRecord[];
      return rows.map(serializeGiftCardRow);
    }
    console.error("[gift-cards] Prisma giftCard delegate missing; listing via SQL");
    return (await listRaw(filter)).map(serializeGiftCardRow);
  });
}

export async function createGiftCards(input: {
  amountUsd: number;
  quantity: number;
  note?: string;
  expiresAt?: Date | null;
  createdBy: string;
  wagerMultiplier?: number;
}) {
  const amountUsd = usd(input.amountUsd);
  if (!(amountUsd >= 1)) throw new Error("AMOUNT_TOO_LOW");
  const quantity = Math.min(50, Math.max(1, Math.round(input.quantity)));
  const wagerMultiplier = clampWagerMultiplier(input.wagerMultiplier);
  const note = (input.note ?? "").trim().slice(0, 240);

  return withGiftCardSchema(async () => {
    const db = await readyGiftCardDelegate();
    if (!db) console.error("[gift-cards] Prisma giftCard delegate missing; creating via SQL");
    const cards: SerializedGiftCard[] = [];
    for (let i = 0; i < quantity; i++) {
      let code = generateGiftCode();
      for (let attempt = 0; attempt < 8; attempt++) {
        const clash = db
          ? await db.findUnique({ where: { code } })
          : await findByCodeRaw(code);
        if (!clash) break;
        code = generateGiftCode();
      }
      const row = db
        ? ((await db.create({
            data: {
              code,
              amountUsd,
              status: "UNUSED",
              createdBy: input.createdBy,
              expiresAt: input.expiresAt ?? null,
              note,
              wagerMultiplier,
            },
          })) as GiftCardRecord)
        : await insertRaw({
            code,
            amountUsd,
            createdBy: input.createdBy,
            expiresAt: input.expiresAt ?? null,
            note,
            wagerMultiplier,
          });
      cards.push(serializeGiftCardRow(row));
    }
    return cards;
  });
}

export async function disableGiftCard(id: string) {
  return withGiftCardSchema(async () => {
    const db = await readyGiftCardDelegate();
    const row = db ? await db.findUnique({ where: { id } }) : await findByIdRaw(id);
    if (!row) throw new Error("GIFT_CARD_INVALID");
    if (row.status === "REDEEMED") throw new Error("GIFT_CARD_USED");
    if (row.status === "DISABLED") return serializeGiftCardRow(row as GiftCardRecord);
    if (db) {
      const updated = (await db.update({
        where: { id },
        data: { status: "DISABLED" },
        include: { redeemedBy: { select: { displayName: true } } },
      })) as GiftCardRecord;
      return serializeGiftCardRow(updated);
    }
    await prisma.$executeRaw`UPDATE "GiftCard" SET "status" = ${"DISABLED"} WHERE "id" = ${id}`;
    return serializeGiftCardRow(((await findByIdRaw(id)) ?? { ...row, status: "DISABLED" }) as GiftCardRecord);
  });
}
