import { createRequire } from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const nodeRequire = createRequire(import.meta.url);

function withSearchParam(url: string, key: string, value: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Neon pooled host → unpooled (for Prisma `directUrl` / `db push`). */
export function neonDirectUrl(raw: string) {
  return raw.replace("-pooler.", ".");
}

/**
 * PgBouncer transaction mode (Neon `-pooler`) needs `pgbouncer=true` or
 * Prisma interactive transactions (`$transaction(async tx => …)`) fail at runtime.
 */
export function neonRuntimeUrl(raw: string) {
  if (!raw.includes("-pooler")) return raw;
  return withSearchParam(withSearchParam(raw, "pgbouncer", "true"), "connect_timeout", "15");
}

function prepareNeonEnv() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//i.test(url)) return;
  if (!process.env.DIRECT_URL) process.env.DIRECT_URL = neonDirectUrl(url);
  process.env.DATABASE_URL = neonRuntimeUrl(url);
}

prepareNeonEnv();

function prismaCtor(): typeof PrismaClient {
  try {
    const cache = nodeRequire.cache;
    if (cache) {
      for (const key of Object.keys(cache)) {
        if (key.includes(`${path.sep}.prisma${path.sep}client`) || key.includes(`${path.sep}@prisma${path.sep}client`)) {
          delete cache[key];
        }
      }
    }
    const loaded = nodeRequire("@prisma/client") as { PrismaClient?: typeof PrismaClient };
    if (loaded.PrismaClient) return loaded.PrismaClient;
  } catch (err) {
    console.error("[db] reload PrismaClient failed", err);
  }
  return PrismaClient;
}

function makeClient() {
  const Ctor = prismaCtor();
  return new Ctor({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasDelegate(client: PrismaClient, key: "giftCard" | "deposit" | "withdrawal") {
  try {
    return Boolean((client as unknown as Record<string, unknown>)[key]);
  } catch {
    return false;
  }
}

/**
 * Next can keep a PrismaClient constructed before `prisma generate`. If
 * GiftCard/Deposit/Withdrawal delegates are missing, drop the instance and
 * reload the constructor from disk so a generate is enough — no restart.
 */
export function ensurePrisma() {
  let client = globalForPrisma.prisma ?? makeClient();
  if (
    !hasDelegate(client, "giftCard") ||
    !hasDelegate(client, "deposit") ||
    !hasDelegate(client, "withdrawal")
  ) {
    void client.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
    client = makeClient();
  }
  globalForPrisma.prisma = client;
  prisma = client;
  return client;
}

export let prisma = globalForPrisma.prisma ?? makeClient();
globalForPrisma.prisma = prisma;
ensurePrisma();

export const DEMO_USER_ID = "local-demo";
export const ADMIN_USER_ID = "admin";

export function usd(n: number) {
  return Math.round(n * 100) / 100;
}

/** Safe Deposit delegate — undefined until `prisma generate` after the Deposit model. */
export function depositDelegate() {
  return (ensurePrisma() as unknown as { deposit?: DepositDelegate }).deposit ?? null;
}

export function giftCardDelegate() {
  try {
    const db = (ensurePrisma() as unknown as { giftCard?: GiftCardDelegate }).giftCard;
    if (!db) {
      console.error("[db] Prisma client has no giftCard delegate — run: node scripts/prisma-env.mjs generate");
    }
    return db ?? null;
  } catch (err) {
    console.error("[db] giftCard delegate failed", err);
    return null;
  }
}

export function withdrawalDelegate() {
  return (ensurePrisma() as unknown as { withdrawal?: WithdrawalDelegate }).withdrawal ?? null;
}

type DepositDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<DepositRow[]>;
  findUnique: (args: Record<string, unknown>) => Promise<DepositRow | null>;
  create: (args: Record<string, unknown>) => Promise<DepositRow>;
  update: (args: Record<string, unknown>) => Promise<DepositRow>;
  count: (args?: Record<string, unknown>) => Promise<number>;
};

type GiftCardDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<GiftCardRow[]>;
  findUnique: (args: Record<string, unknown>) => Promise<GiftCardRow | null>;
  create: (args: Record<string, unknown>) => Promise<GiftCardRow>;
  update: (args: Record<string, unknown>) => Promise<GiftCardRow>;
  count: (args?: Record<string, unknown>) => Promise<number>;
};

type GiftCardRow = {
  id: string;
  code: string;
  amountUsd: number;
  status: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  redeemedByUserId: string | null;
  redeemedAt: Date | null;
  note: string;
  wagerMultiplier: number;
  redeemedBy?: { displayName: string } | null;
};

type DepositRow = {
  id: string;
  userId: string;
  asset: string;
  network: string;
  address: string;
  amountUsd: number;
  amountCrypto: number;
  status: string;
  txNote: string;
  txHash: string;
  promoCode: string;
  bonusUsd: number;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  user?: { displayName: string } | null;
};

type WithdrawalDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<WithdrawalRow[]>;
  findUnique: (args: Record<string, unknown>) => Promise<WithdrawalRow | null>;
  create: (args: Record<string, unknown>) => Promise<WithdrawalRow>;
  update: (args: Record<string, unknown>) => Promise<WithdrawalRow>;
  count: (args?: Record<string, unknown>) => Promise<number>;
};

type WithdrawalRow = {
  id: string;
  userId: string;
  amountUsd: number;
  status: string;
  note: string;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  kind?: string;
  inventoryItemId?: string | null;
  itemName?: string;
  tradeUrl?: string;
  user?: { displayName: string } | null;
  inventoryItem?: {
    id: string;
    skinId: string;
    wear: string;
    stattrak: boolean;
    acquiredAt: Date;
  } | null;
};
