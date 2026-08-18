#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CASES_FILE = join(ROOT, "data/cases.ts");
const ASSETS = join(ROOT, "public/assets/cases");
const ALLOWED = new Set([".svg", ".webp", ".png"]);

const src = readFileSync(CASES_FILE, "utf8");
const ids = [...src.matchAll(/makeCase\(\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniqueIds = [...new Set(ids)];

function resolve(id, file) {
  for (const ext of ["png", "webp", "svg"]) {
    const abs = join(ASSETS, id, `${file}.${ext}`);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

const hashes = new Map();
let missing = 0;
let images = 0;
const issues = [];

for (const id of uniqueIds) {
  for (const file of ["case", "thumbnail", "background"]) {
    const abs = resolve(id, file);
    if (!abs) {
      missing += 1;
      issues.push(`missing ${id}/${file}`);
      continue;
    }
    if (!ALLOWED.has(extname(abs).toLowerCase())) {
      missing += 1;
      issues.push(`format ${id}/${file}`);
      continue;
    }
    if (statSync(abs).size < 32) {
      missing += 1;
      issues.push(`empty ${id}/${file}`);
      continue;
    }
    if (file === "case") images += 1;
    const digest = createHash("sha256").update(readFileSync(abs)).digest("hex");
    const list = hashes.get(digest) ?? [];
    list.push(`${id}/${file}${extname(abs)}`);
    hashes.set(digest, list);
  }
}

const dups = [...hashes.values()].filter((v) => v.length > 1);
const folders = existsSync(ASSETS) ? readdirSync(ASSETS).filter((d) => statSync(join(ASSETS, d)).isDirectory() && d !== "_fallback") : [];
const log = `Cases ${uniqueIds.length}, Images ${images}, Missing ${missing}, Duplicates ${dups.length}`;
console.log(log);
if (folders.length !== uniqueIds.length) {
  console.log(`Folder/id mismatch: cases ${uniqueIds.length}, asset folders ${folders.length}`);
}
if (issues.length) console.log(issues.slice(0, 20).join("\n"));
if (dups.length) console.log(dups.map((d) => d.join(" == ")).join("\n"));
if (missing || dups.length) process.exit(1);
