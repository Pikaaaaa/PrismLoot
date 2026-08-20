import { randomUUID } from "node:crypto";
import { getCase } from "@/data/cases";
import {
  generateCaseCouponCode,
  isCaseCouponFormat,
  normalizeCaseCouponCode,
} from "@/lib/case-coupons/codes";
import { withCaseCouponSchema } from "@/lib/case-coupons/ensure";
import type {
  CaseCouponRedeemResult,
  FreeCaseClaimSummary,
  SerializedCaseCoupon,
} from "@/lib/case-coupons/types";
import { prisma } from "@/lib/db";
import { prismaErrorCode } from "@/lib/persist/errors";

type CouponRow = {
  id: string;
  code: string;
  caseId: string;
  maxUses: number;
  remaining: number;
  usedCount: number;
  opensPerRedeem: number;
  expiresAt: Date | string | null;
  enabled: boolean | number;
  createdBy: string;
  createdAt: Date | string;
  note: string;
  caseName?: string | null;
};

type ClaimRow = {
  id: string;
  couponId: string;
  userId: string;
  caseId: string;
  remaining: number;
  usedCount: number;
  createdAt: Date | string;
};

type SqlClient = {
  $queryRaw: (typeof prisma)["$queryRaw"];
  $executeRaw: (typeof prisma)["$executeRaw"];
};

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asBool(value: boolean | number) {
  return value === true || value === 1;
}

function asInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function caseNameFor(caseId: string, stored?: string | null) {
  return stored?.trim() || getCase(caseId)?.name || caseId;
}

export function serializeCaseCoupon(row: CouponRow): SerializedCaseCoupon {
  return {
    id: row.id,
    code: row.code,
    caseId: row.caseId,
    caseName: caseNameFor(row.caseId, row.caseName),
    maxUses: asInt(row.maxUses, 1),
    remaining: asInt(row.remaining),
    usedCount: asInt(row.usedCount),
    opensPerRedeem: asInt(row.opensPerRedeem, 1),
    expiresAt: iso(row.expiresAt),
    enabled: asBool(row.enabled),
    createdBy: row.createdBy ?? "",
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    note: row.note ?? "",
  };
}

async function findByCode(db: SqlClient, code: string) {
  const rows = await db.$queryRaw<CouponRow[]>`
    SELECT * FROM "CaseCoupon" WHERE "code" = ${code} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findById(db: SqlClient, id: string) {
  const rows = await db.$queryRaw<CouponRow[]>`
    SELECT
      c."id", c."code", c."caseId", c."maxUses", c."remaining", c."usedCount",
      c."opensPerRedeem", c."expiresAt", c."enabled", c."createdBy", c."createdAt", c."note",
      k."name" AS "caseName"
    FROM "CaseCoupon" c
    LEFT JOIN "Case" k ON k."id" = c."caseId"
    WHERE c."id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listCaseCoupons() {
  return withCaseCouponSchema(async () => {
    const rows = await prisma.$queryRaw<CouponRow[]>`
      SELECT
        c."id", c."code", c."caseId", c."maxUses", c."remaining", c."usedCount",
        c."opensPerRedeem", c."expiresAt", c."enabled", c."createdBy", c."createdAt", c."note",
        k."name" AS "caseName"
      FROM "CaseCoupon" c
      LEFT JOIN "Case" k ON k."id" = c."caseId"
      ORDER BY c."createdAt" DESC
      LIMIT 200
    `;
    return rows.map(serializeCaseCoupon);
  });
}

export async function createCaseCoupons(input: {
  caseId: string;
  code?: string;
  maxUses: number;
  opensPerRedeem: number;
  quantity: number;
  note?: string;
  expiresAt?: Date | null;
  createdBy: string;
}) {
  const caseId = input.caseId.trim();
  if (!getCase(caseId)) throw new Error("CASE_NOT_FOUND");
  const maxUses = Math.min(1000, Math.max(1, Math.round(input.maxUses)));
  const opensPerRedeem = Math.min(50, Math.max(1, Math.round(input.opensPerRedeem)));
  const custom = input.code?.trim() ? normalizeCaseCouponCode(input.code) : "";
  if (custom && !isCaseCouponFormat(custom)) throw new Error("INVALID_INPUT");
  const quantity = custom ? 1 : Math.min(50, Math.max(1, Math.round(input.quantity)));
  const note = (input.note ?? "").trim().slice(0, 240);

  return withCaseCouponSchema(async () => {
    const coupons: SerializedCaseCoupon[] = [];
    for (let i = 0; i < quantity; i++) {
      let code = custom || generateCaseCouponCode();
      if (!custom) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const clash = await findByCode(prisma, code);
          if (!clash) break;
          code = generateCaseCouponCode();
        }
      } else {
        const clash = await findByCode(prisma, code);
        if (clash) throw new Error("CASE_COUPON_EXISTS");
      }
      const id = randomUUID();
      const createdAt = new Date();
      await prisma.$executeRaw`
        INSERT INTO "CaseCoupon" (
          "id", "code", "caseId", "maxUses", "remaining", "usedCount", "opensPerRedeem",
          "expiresAt", "enabled", "createdBy", "createdAt", "note"
        ) VALUES (
          ${id}, ${code}, ${caseId}, ${maxUses}, ${maxUses}, ${0}, ${opensPerRedeem},
          ${input.expiresAt ?? null}, ${true}, ${input.createdBy}, ${createdAt}, ${note}
        )
      `;
      coupons.push(
        serializeCaseCoupon(
          (await findById(prisma, id)) ?? {
            id,
            code,
            caseId,
            maxUses,
            remaining: maxUses,
            usedCount: 0,
            opensPerRedeem,
            expiresAt: input.expiresAt ?? null,
            enabled: true,
            createdBy: input.createdBy,
            createdAt,
            note,
          },
        ),
      );
    }
    return coupons;
  });
}

export async function disableCaseCoupon(id: string) {
  return withCaseCouponSchema(async () => {
    const row = await findById(prisma, id);
    if (!row) throw new Error("CASE_COUPON_INVALID");
    if (!asBool(row.enabled)) return serializeCaseCoupon(row);
    await prisma.$executeRaw`UPDATE "CaseCoupon" SET "enabled" = ${false} WHERE "id" = ${id}`;
    return serializeCaseCoupon({ ...row, enabled: false });
  });
}

export async function listUserFreeCaseClaims(userId: string): Promise<FreeCaseClaimSummary[]> {
  return withCaseCouponSchema(async () => {
    const rows = await prisma.$queryRaw<Array<{ caseId: string; remaining: number | bigint }>>`
      SELECT "caseId", SUM("remaining") AS "remaining"
      FROM "CaseCouponClaim"
      WHERE "userId" = ${userId} AND "remaining" > 0
      GROUP BY "caseId"
    `;
    return rows
      .map((row) => ({
        caseId: row.caseId,
        caseName: caseNameFor(row.caseId),
        remaining: asInt(row.remaining),
      }))
      .filter((row) => row.remaining > 0);
  });
}

function assertCouponRedeemable(row: CouponRow) {
  if (!asBool(row.enabled)) throw new Error("CASE_COUPON_DISABLED");
  if (asInt(row.remaining) < 1) throw new Error("CASE_COUPON_EXHAUSTED");
  if (row.expiresAt) {
    const at = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
    if (!Number.isNaN(at.getTime()) && at.getTime() <= Date.now()) throw new Error("CASE_COUPON_EXPIRED");
  }
}

export async function redeemCaseCoupon(input: {
  code: string;
  userId: string;
}): Promise<CaseCouponRedeemResult> {
  const code = normalizeCaseCouponCode(input.code);
  if (!isCaseCouponFormat(code)) throw new Error("CASE_COUPON_INVALID");

  return withCaseCouponSchema(async () => {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.banned) throw new Error("USER_BANNED");

    const result = await prisma.$transaction(async (tx) => {
      const coupon = await findByCode(tx, code);
      if (!coupon) throw new Error("CASE_COUPON_INVALID");
      assertCouponRedeemable(coupon);

      const existing = await tx.$queryRaw<ClaimRow[]>`
        SELECT * FROM "CaseCouponClaim"
        WHERE "couponId" = ${coupon.id} AND "userId" = ${input.userId}
        LIMIT 1
      `;
      if (existing[0]) throw new Error("CASE_COUPON_USED");

      const taken = await tx.$executeRaw`
        UPDATE "CaseCoupon"
        SET "remaining" = "remaining" - 1, "usedCount" = "usedCount" + 1
        WHERE "id" = ${coupon.id} AND "remaining" > 0 AND "enabled" = ${true}
      `;
      if (Number(taken) < 1) throw new Error("CASE_COUPON_EXHAUSTED");

      const opens = Math.max(1, asInt(coupon.opensPerRedeem, 1));
      const claimId = randomUUID();
      const createdAt = new Date();
      try {
        await tx.$executeRaw`
          INSERT INTO "CaseCouponClaim" (
            "id", "couponId", "userId", "caseId", "remaining", "usedCount", "createdAt"
          ) VALUES (
            ${claimId}, ${coupon.id}, ${input.userId}, ${coupon.caseId}, ${opens}, ${0}, ${createdAt}
          )
        `;
      } catch (err) {
        if (prismaErrorCode(err) === "P2002") throw new Error("CASE_COUPON_USED");
        throw err;
      }

      return {
        code: coupon.code,
        caseId: coupon.caseId,
        caseName: caseNameFor(coupon.caseId),
        opens,
        claim: {
          caseId: coupon.caseId,
          caseName: caseNameFor(coupon.caseId),
          remaining: opens,
        },
      };
    });

    return result;
  });
}

/** Consume up to `count` free opens for this case. Returns how many were consumed. */
export async function consumeFreeCaseClaims(
  db: SqlClient,
  input: { userId: string; caseId: string; count: number },
) {
  const want = Math.max(0, Math.floor(input.count));
  if (want <= 0) return 0;
  const rows = await db.$queryRaw<ClaimRow[]>`
    SELECT * FROM "CaseCouponClaim"
    WHERE "userId" = ${input.userId} AND "caseId" = ${input.caseId} AND "remaining" > 0
    ORDER BY "createdAt" ASC
  `;
  let left = want;
  for (const row of rows) {
    if (left <= 0) break;
    const take = Math.min(left, asInt(row.remaining));
    if (take <= 0) continue;
    const updated = await db.$executeRaw`
      UPDATE "CaseCouponClaim"
      SET "remaining" = "remaining" - ${take}, "usedCount" = "usedCount" + ${take}
      WHERE "id" = ${row.id} AND "remaining" >= ${take}
    `;
    if (Number(updated) >= 1) left -= take;
  }
  return want - left;
}
