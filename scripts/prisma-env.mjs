#!/usr/bin/env node
/**
 * Picks SQLite vs Postgres Prisma schema from DATABASE_URL so local `npm run dev`
 * stays on file:./dev.db. Vercel (VERCEL=1) and postgresql:// URLs use
 * prisma/schema.postgres.prisma.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(name) {
  const abs = path.join(root, name);
  if (!existsSync(abs)) return;
  for (const raw of readFileSync(abs, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

parseEnvFile(".env");
parseEnvFile(".env.local");

const url = process.env.DATABASE_URL ?? "";
const postgres =
  /^postgres(ql)?:\/\//i.test(url) || process.env.VERCEL === "1";
const schema = postgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma";
const extra = process.argv.slice(2);

if (!extra.length) {
  console.error("usage: node scripts/prisma-env.mjs <prisma args>");
  process.exit(1);
}

console.error(`[prisma] ${postgres ? "postgresql" : "sqlite"} → ${schema}`);

const bin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const result = spawnSync(bin, [...extra, "--schema", schema], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
