import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { CASE_ASSET_EXTS, CASE_FALLBACK_ID, caseArtPaths } from "@/lib/case-art";

export type CaseAssetIssue = {
  caseId: string;
  field: "image" | "thumbnail" | "background";
  reason: "missing" | "format" | "empty" | "duplicate";
  path: string;
  detail?: string;
};

export type CaseAssetReport = {
  ok: boolean;
  cases: number;
  images: number;
  thumbnails: number;
  backgrounds: number;
  missing: number;
  duplicates: number;
  issues: CaseAssetIssue[];
  sample: Array<{ id: string; image: string; thumbnail: string; background: string }>;
  log: string;
};

const ALLOWED = new Set(CASE_ASSET_EXTS.map((e) => `.${e}`));
const ASSET_ROOT = join(process.cwd(), "public", "assets", "cases");
const CASES_FILE = join(process.cwd(), "data", "cases.ts");

function readCaseIds(): string[] {
  if (!existsSync(/* turbopackIgnore: true */ CASES_FILE)) return [];
  const src = readFileSync(/* turbopackIgnore: true */ CASES_FILE, "utf8");
  return [...new Set([...src.matchAll(/makeCase\(\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]))];
}

function resolveExisting(publicUrl: string) {
  const abs = join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  if (existsSync(/* turbopackIgnore: true */ abs) && statSync(/* turbopackIgnore: true */ abs).isFile()) {
    return { abs, publicUrl, ext: extname(abs).toLowerCase() };
  }
  const base = publicUrl.replace(/\.(svg|webp|png)$/i, "");
  for (const ext of CASE_ASSET_EXTS) {
    const url = `${base}.${ext}`;
    const path = join(process.cwd(), "public", url.replace(/^\//, ""));
    if (existsSync(/* turbopackIgnore: true */ path) && statSync(/* turbopackIgnore: true */ path).isFile()) {
      return { abs: path, publicUrl: url, ext: `.${ext}` };
    }
  }
  return null;
}

function sha(abs: string) {
  return createHash("sha256").update(readFileSync(/* turbopackIgnore: true */ abs)).digest("hex");
}

export function validateCaseAssets(): CaseAssetReport {
  const issues: CaseAssetIssue[] = [];
  const hashOwners = new Map<string, string[]>();
  let images = 0;
  let thumbnails = 0;
  let backgrounds = 0;
  const ids = readCaseIds();

  for (const id of ids) {
    const expected = caseArtPaths(id);
    const fields = [
      ["image", expected.image],
      ["thumbnail", expected.thumbnail],
      ["background", expected.background],
    ] as const;

    for (const [field, url] of fields) {
      const found = resolveExisting(url);
      if (!found) {
        issues.push({ caseId: id, field, reason: "missing", path: url });
        continue;
      }
      const size = statSync(/* turbopackIgnore: true */ found.abs).size;
      if (size < 32) {
        issues.push({ caseId: id, field, reason: "empty", path: found.publicUrl });
        continue;
      }
      if (!ALLOWED.has(found.ext)) {
        issues.push({ caseId: id, field, reason: "format", path: found.publicUrl, detail: found.ext });
        continue;
      }
      if (field === "image") images += 1;
      if (field === "thumbnail") thumbnails += 1;
      if (field === "background") backgrounds += 1;
      const digest = sha(found.abs);
      const owner = `${id}:${field}`;
      const list = hashOwners.get(digest) ?? [];
      list.push(owner);
      hashOwners.set(digest, list);
    }
  }

  for (const file of ["case.png", "thumbnail.png", "background.png"]) {
    const abs = join(ASSET_ROOT, CASE_FALLBACK_ID, file);
    if (!existsSync(/* turbopackIgnore: true */ abs)) {
      issues.push({
        caseId: CASE_FALLBACK_ID,
        field: file.startsWith("case") ? "image" : file.startsWith("thumb") ? "thumbnail" : "background",
        reason: "missing",
        path: `/assets/cases/${CASE_FALLBACK_ID}/${file}`,
      });
    }
  }

  let duplicates = 0;
  for (const [digest, owners] of hashOwners) {
    if (owners.length < 2) continue;
    duplicates += owners.length - 1;
    for (const owner of owners) {
      const [caseId, field] = owner.split(":") as [string, CaseAssetIssue["field"]];
      issues.push({
        caseId,
        field,
        reason: "duplicate",
        path: caseArtPaths(caseId)[field === "image" ? "image" : field],
        detail: `${owners.join(", ")} share ${digest.slice(0, 8)}`,
      });
    }
  }

  const missing = issues.filter((i) => i.reason === "missing" || i.reason === "empty" || i.reason === "format").length;
  const log = `Cases ${ids.length}, Images ${images}, Missing ${missing}, Duplicates ${duplicates}`;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[PrismLoot assets] ${log}`);
  }

  return {
    ok: missing === 0 && duplicates === 0,
    cases: ids.length,
    images,
    thumbnails,
    backgrounds,
    missing,
    duplicates,
    issues,
    sample: ids.slice(0, 6).map((id) => ({
      id,
      image: caseArtPaths(id).image,
      thumbnail: caseArtPaths(id).thumbnail,
      background: caseArtPaths(id).background,
    })),
    log,
  };
}

export function listCaseAssetFolders() {
  if (!existsSync(/* turbopackIgnore: true */ ASSET_ROOT)) return [];
  return readdirSync(/* turbopackIgnore: true */ ASSET_ROOT).filter((name) =>
    statSync(/* turbopackIgnore: true */ join(ASSET_ROOT, name)).isDirectory(),
  );
}
