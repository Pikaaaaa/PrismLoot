#!/usr/bin/env node
/**
 * Builds data/stickers.ts — curated EXPENSIVE Katowice stickers only.
 * Hard gate: no paper commons, no bulk 2015/2019 dump. Crown-jewel 2014
 * Holo/Foil + a few liquid top-tier anchors. Illiquid holos use documented
 * mid-market anchors (Buff/csdb/esportfire); SCM used when liquid.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data/stickers.ts");
const API_STICKERS = path.join(ROOT, "tmp/stickers.json");
const API_PRICES = path.join(ROOT, "tmp/prices.json");
const STICKERS_URL = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json";
const PRICES_URL = "https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json";

/** Snapshot timestamp for generated sticker face values (Aug 2026 refresh). */
const FETCHED_AT = Date.UTC(2026, 7, 21, 12, 0, 0);

/**
 * Illiquid Katowice 2014 Holo mid-market USD (unapplied).
 * SCM rarely lists these; anchors from Buff163 / csdb.gg / esportfire (2026).
 * Conservative mids — not max asks (Titan ask ~148k; we seed ~95k mid).
 */
const K14_HOLO_ANCHORS = {
  Titan: 95000,
  iBUYPOWER: 72000,
  "Reason Gaming": 52000,
  "Team LDLC.com": 18500,
  "Vox Eminor": 17500,
  HellRaisers: 14000,
  "Natus Vincere": 12500,
  "Virtus.Pro": 11000,
  "Ninjas in Pyjamas": 9800,
  mousesports: 9000,
  "Clan-Mystik": 8500,
  "LGB eSports": 8000,
  "Team Dignitas": 7200,
  "3DMAX": 6800,
  "compLexity Gaming": 6200,
  Fnatic: 5500,
};

/** Top Katowice 2014 Foil mid-market USD — only crown / high-demand teams. */
const K14_FOIL_ANCHORS = {
  Titan: 18500,
  iBUYPOWER: 16000,
  "Reason Gaming": 12000,
  HellRaisers: 9500,
  "Vox Eminor": 9000,
  "Team LDLC.com": 8500,
  "Natus Vincere": 7800,
  Fnatic: 6500,
};

/** Explicit allowlist beyond 2014 Holo/top Foil (must still clear MIN_SCM_USD if priced from SCM). */
const EXTRA_ALLOW = new Set([
  "Sticker | ESL Wolf (Foil) | Katowice 2014",
  "Sticker | Titan (Holo) | Katowice 2015",
  "Sticker | Titan (Foil) | Katowice 2015",
  "Sticker | Natus Vincere (Holo) | Katowice 2015",
  "Sticker | ZywOo (Gold) | Katowice 2019",
]);

/** SCM floor for EXTRA_ALLOW entries (skip cheap liquid noise). */
const MIN_SCM_USD = 650;

function money(n) {
  if (!(n > 0) || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

function effectOf(row, name) {
  const e = row.effect || "";
  if (/holo/i.test(e) || /\(Holo\)/i.test(name)) return "Holo";
  if (/foil/i.test(e) || /\(Foil\)/i.test(name)) return "Foil";
  if (/gold/i.test(e) || /\(Gold\)/i.test(name)) return "Gold";
  if (/glitter/i.test(e)) return "Glitter";
  if (/lenticular/i.test(e)) return "Lenticular";
  return "Other";
}

function yearOf(name, row) {
  const fromName = String(name).match(/Katowice\s+(20\d{2})/i);
  if (fromName) return Number(fromName[1]);
  const fromEvent = String(row.tournament_event || row.tournament?.name || "").match(/20\d{2}/);
  return fromEvent ? Number(fromEvent[0]) : 0;
}

function teamOf(row, name) {
  return row.tournament_team || row.team?.name || undefined;
}

function playerOf(row, name) {
  if (row.player?.name) return row.player.name;
  if (row.type === "Player" || row.type === "Autograph") {
    const m = String(name).match(/^Sticker \|\s*(.+?)\s*\(/);
    if (m) return m[1].trim();
  }
  // Gold autographs: "Sticker | ZywOo (Gold) | Katowice 2019"
  const auto = String(name).match(/^Sticker \|\s*([^|(]+?)\s*\(Gold\)\s*\|\s*Katowice/i);
  if (auto) return auto[1].trim();
  return undefined;
}

async function loadJson(file, url) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  const data = await res.json();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

function scmPrice(scm, hash) {
  const v = scm[hash];
  if (typeof v === "number" && v > 0) return money(v / 100);
  return null;
}

function resolveFace(hash, effect, year, team, scm) {
  const liquid = scmPrice(scm, hash);
  // Katowice 2014 Holo/Foil: always prefer documented illiquid mids.
  // SCM listings for these are thin/wrong (e.g. Fnatic Holo ~$1.7k vs real multi‑k).
  if (year === 2014 && effect === "Holo" && team && K14_HOLO_ANCHORS[team] != null) {
    return { price: K14_HOLO_ANCHORS[team], source: "illiquid-mid (Buff/csdb 2026)" };
  }
  if (year === 2014 && effect === "Foil" && team && K14_FOIL_ANCHORS[team] != null) {
    return { price: K14_FOIL_ANCHORS[team], source: "illiquid-mid (Buff/csdb 2026)" };
  }
  if (liquid && liquid >= MIN_SCM_USD) return { price: liquid, source: "Steam Community Market dump" };
  return null;
}

function makeId(hash, used) {
  const core = hash
    .replace(/^Sticker\s*\|\s*/i, "")
    .replace(/\s*\|\s*/g, "-")
    .replace(/\(|\)/g, "");
  let id = `stk-${slug(core)}`;
  if (!used.has(id)) return id;
  let n = 2;
  while (used.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

function shouldKeep(row, hash, effect, year, team) {
  if (/Slab/i.test(hash)) return false;
  if (!/Katowice/i.test(hash)) return false;
  // Hard gate: never paper commons.
  if (effect === "Other" || (!/\((?:Holo|Foil|Gold)\)/i.test(hash) && effect !== "Holo" && effect !== "Foil" && effect !== "Gold")) {
    return false;
  }
  if (year === 2014 && effect === "Holo" && team && K14_HOLO_ANCHORS[team] != null) return true;
  if (year === 2014 && effect === "Foil" && team && K14_FOIL_ANCHORS[team] != null) return true;
  if (EXTRA_ALLOW.has(hash)) return true;
  return false;
}

async function main() {
  const api = await loadJson(API_STICKERS, STICKERS_URL);
  const priceDump = await loadJson(API_PRICES, PRICES_URL);
  const scm = priceDump.prices || priceDump;

  const used = new Set();
  const picked = [];

  for (const row of api) {
    const hash = row.market_hash_name || row.name;
    if (!hash || !/^Sticker \|/i.test(hash)) continue;
    const effect = effectOf(row, hash);
    const year = yearOf(hash, row);
    const team = teamOf(row, hash);
    if (!shouldKeep(row, hash, effect, year, team)) continue;

    const face = resolveFace(hash, effect, year, team, scm);
    if (!face) continue;
    if (EXTRA_ALLOW.has(hash) && face.price < MIN_SCM_USD && !(year === 2014)) continue;

    const id = makeId(hash, used);
    used.add(id);
    picked.push({
      id,
      name: hash.replace(/^Sticker \|\s*/i, "Sticker | "),
      marketHashName: hash,
      tournament: `Katowice ${year}`,
      year,
      team: team || undefined,
      player: playerOf(row, hash),
      effect,
      price: face.price,
      currency: "USD",
      image: row.image || undefined,
      priceSource: face.source,
      priceUpdatedAt: FETCHED_AT,
    });
  }

  picked.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));

  // Soft cap — curated expensive set must stay short.
  if (picked.length > 40) {
    throw new Error(`Sticker catalog too large (${picked.length}) — curation gate failed`);
  }
  if (picked.length < 20) {
    throw new Error(`Sticker catalog too thin (${picked.length}) — missing 2014 holos?`);
  }

  const ts = `import type { Sticker } from "@/lib/types";

/**
 * Curated expensive Katowice stickers only (no paper commons / bulk dump).
 * Generated by scripts/build-sticker-catalog.mjs.
 * Face \`price\` = unapplied market; applied crafts use APPLIED_STICKER_FACTOR in lib/economy/stickerValue.ts.
 */

export const STICKERS = [
${picked
  .map((s) => {
    const team = s.team ? `,\n    team: ${JSON.stringify(s.team)}` : "";
    const player = s.player ? `,\n    player: ${JSON.stringify(s.player)}` : "";
    const image = s.image ? `,\n    image: ${JSON.stringify(s.image)}` : "";
    return `  {
    id: ${JSON.stringify(s.id)},
    name: ${JSON.stringify(s.name)},
    marketHashName: ${JSON.stringify(s.marketHashName)},
    tournament: ${JSON.stringify(s.tournament)},
    year: ${s.year}${team}${player},
    effect: ${JSON.stringify(s.effect)},
    price: ${s.price},
    currency: "USD"${image},
    priceSource: ${JSON.stringify(s.priceSource)},
    priceUpdatedAt: ${s.priceUpdatedAt},
  }`;
  })
  .join(",\n")}
] as const satisfies readonly Sticker[];

export const STICKER_MAP: Record<string, Sticker> = Object.fromEntries(STICKERS.map((s) => [s.id, s]));
`;

  fs.writeFileSync(OUT, ts);
  console.log(
    JSON.stringify(
      {
        stickers: picked.length,
        minPrice: picked[picked.length - 1]?.price,
        maxPrice: picked[0]?.price,
        byYear: picked.reduce((acc, s) => {
          acc[s.year] = (acc[s.year] || 0) + 1;
          return acc;
        }, {}),
        byEffect: picked.reduce((acc, s) => {
          acc[s.effect] = (acc[s.effect] || 0) + 1;
          return acc;
        }, {}),
        top5: picked.slice(0, 5).map((s) => ({ id: s.id, price: s.price, name: s.name })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
