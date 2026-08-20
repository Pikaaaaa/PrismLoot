import { ensurePrisma } from "@/lib/db";
import { prismaErrorCode } from "@/lib/persist/errors";

let ready: Promise<void> | null = null;

function isPostgres() {
  const url = process.env.DATABASE_URL ?? "";
  return /^postgres(ql)?:\/\//i.test(url) || process.env.VERCEL === "1";
}

export function isInventorySchemaError(err: unknown) {
  const code = prismaErrorCode(err);
  return code === "P2021" || code === "P2022";
}

function resetInventorySchema() {
  ready = null;
}

/**
 * Neon `db push` can lag the app. Add `leftVia` on first vault read/write so
 * history badges don't 500.
 */
export function ensureInventoryHistorySchema() {
  ready ??= applyInventoryHistorySchema().catch((err) => {
    resetInventorySchema();
    throw err;
  });
  return ready;
}

async function applyInventoryHistorySchema() {
  const client = ensurePrisma();
  if (isPostgres()) {
    await client.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "leftVia" TEXT`;
    return;
  }

  const cols = await client.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("InventoryItem")`);
  if (!cols.some((col) => col.name === "leftVia")) {
    await client.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN "leftVia" TEXT`;
  }
}

export async function withInventoryHistorySchema<T>(run: () => Promise<T>): Promise<T> {
  await ensureInventoryHistorySchema();
  try {
    return await run();
  } catch (err) {
    if (!isInventorySchemaError(err)) throw err;
    console.error("[inventory] leftVia missing, retrying after ALTER TABLE", err);
    resetInventorySchema();
    await ensureInventoryHistorySchema();
    return run();
  }
}
