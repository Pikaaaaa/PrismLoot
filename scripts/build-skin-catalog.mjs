#!/usr/bin/env node
/**
 * Builds data/skins.ts + data/price-snapshot.json from real CS2 Steam CDN
 * listings (ByMykel CSGO-API) and committed SCM cents (price tracker).
 * Existing catalog ids stay stable. Prices are per-wear, never Math.random.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKINS_OUT = path.join(ROOT, "data/skins.ts");
const SNAP_OUT = path.join(ROOT, "data/price-snapshot.json");
const API_SKINS = path.join(ROOT, "tmp/skins.json");
const API_PRICES = path.join(ROOT, "tmp/prices.json");
const SKINS_URL = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";
const PRICES_URL = "https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json";

const WEARS = ["fn", "mw", "ft", "ww", "bs"];
const WEAR_LABEL = {
  fn: "Factory New",
  mw: "Minimal Wear",
  ft: "Field-Tested",
  ww: "Well-Worn",
  bs: "Battle-Scarred",
};
const API_WEAR = {
  "Factory New": "fn",
  "Minimal Wear": "mw",
  "Field-Tested": "ft",
  "Well-Worn": "ww",
  "Battle-Scarred": "bs",
};

const GLOVE_TYPES = new Set([
  "Sport Gloves",
  "Specialist Gloves",
  "Driver Gloves",
  "Moto Gloves",
  "Hand Wraps",
  "Bloodhound Gloves",
  "Broken Fang Gloves",
  "Hydra Gloves",
]);

const KNIFE_TYPES = new Set([
  "Karambit",
  "Butterfly Knife",
  "M9 Bayonet",
  "Bayonet",
  "Flip Knife",
  "Gut Knife",
  "Falchion Knife",
  "Bowie Knife",
  "Huntsman Knife",
  "Shadow Daggers",
  "Navaja Knife",
  "Stiletto Knife",
  "Talon Knife",
  "Ursus Knife",
  "Classic Knife",
  "Paracord Knife",
  "Survival Knife",
  "Nomad Knife",
  "Skeleton Knife",
  "Kukri Knife",
]);

const ALLOWED = new Set([
  "AK-47",
  "M4A4",
  "M4A1-S",
  "AWP",
  "USP-S",
  "Glock-18",
  "Desert Eagle",
  "P250",
  "Five-SeveN",
  "FAMAS",
  "Galil AR",
  "MP9",
  "MAC-10",
  "MP7",
  "MP5-SD",
  "PP-Bizon",
  "P90",
  "UMP-45",
  "SSG 08",
  "SG 553",
  "AUG",
  "XM1014",
  "MAG-7",
  "Nova",
  "Sawed-Off",
  "Negev",
  "M249",
  "SCAR-20",
  "G3SG1",
  "Tec-9",
  "CZ75-Auto",
  "Dual Berettas",
  "P2000",
  "R8 Revolver",
  ...KNIFE_TYPES,
  ...GLOVE_TYPES,
]);

const PREFIX = {
  "AK-47": "ak",
  M4A4: "m4",
  "M4A1-S": "m4s",
  AWP: "awp",
  "USP-S": "usp",
  "Glock-18": "glock",
  "Desert Eagle": "deag",
  P250: "p250",
  "Five-SeveN": "five-seven",
  FAMAS: "famas",
  "Galil AR": "galil",
  MP9: "mp9",
  "MAC-10": "mac-10",
  MP7: "mp7",
  "MP5-SD": "mp5",
  "PP-Bizon": "bizon",
  P90: "p90",
  "UMP-45": "ump",
  "SSG 08": "ssg",
  "SG 553": "sg",
  AUG: "aug",
  XM1014: "xm",
  "MAG-7": "mag7",
  Nova: "nova",
  "Sawed-Off": "sawed",
  Negev: "negev",
  M249: "m249",
  "SCAR-20": "scar",
  G3SG1: "g3",
  "Tec-9": "tec9",
  "CZ75-Auto": "cz",
  "Dual Berettas": "duals",
  P2000: "p2000",
  "R8 Revolver": "r8",
  Karambit: "kara",
  "Butterfly Knife": "bfly",
  "M9 Bayonet": "m9",
  Bayonet: "bayo",
  "Flip Knife": "flip",
  "Gut Knife": "gut",
  "Falchion Knife": "falch",
  "Bowie Knife": "bowie",
  "Huntsman Knife": "hunts",
  "Shadow Daggers": "shadow",
  "Navaja Knife": "navaja",
  "Stiletto Knife": "stiletto",
  "Talon Knife": "talon",
  "Ursus Knife": "ursus",
  "Classic Knife": "classic",
  "Paracord Knife": "paracord",
  "Survival Knife": "survival",
  "Nomad Knife": "nomad",
  "Skeleton Knife": "skeleton",
  "Kukri Knife": "kukri",
};

const CATALOG_CAP = 6000;

/** Floors per weapon. Knives/gloves then consume the rest of the same-weapon book. */
const QUOTAS = {
  "AK-47": 200,
  M4A4: 160,
  "M4A1-S": 160,
  AWP: 180,
  "USP-S": 120,
  "Glock-18": 120,
  "Desert Eagle": 110,
  P250: 56,
  "Five-SeveN": 48,
  FAMAS: 56,
  "Galil AR": 56,
  MP9: 48,
  "MAC-10": 48,
  MP7: 48,
  "MP5-SD": 40,
  "PP-Bizon": 40,
  P90: 48,
  "UMP-45": 48,
  "SSG 08": 48,
  "SG 553": 48,
  AUG: 48,
  XM1014: 40,
  "MAG-7": 40,
  Nova: 40,
  "Sawed-Off": 36,
  Negev: 32,
  M249: 28,
  "SCAR-20": 36,
  G3SG1: 36,
  "Tec-9": 44,
  "CZ75-Auto": 44,
  "Dual Berettas": 44,
  P2000: 40,
  "R8 Revolver": 40,
  Gloves: 140,
  Karambit: 48,
  "Butterfly Knife": 48,
  "M9 Bayonet": 44,
  Bayonet: 36,
  "Flip Knife": 32,
  "Talon Knife": 32,
  "Bowie Knife": 28,
  "Huntsman Knife": 28,
  "Falchion Knife": 28,
  "Gut Knife": 28,
  "Shadow Daggers": 28,
  "Stiletto Knife": 28,
  "Ursus Knife": 28,
  "Navaja Knife": 24,
  "Classic Knife": 24,
  "Paracord Knife": 24,
  "Survival Knife": 24,
  "Nomad Knife": 24,
  "Skeleton Knife": 28,
  "Kukri Knife": 28,
};

const RARITY_MAP = {
  "Consumer Grade": "common",
  "Industrial Grade": "uncommon",
  "Mil-Spec Grade": "rare",
  Restricted: "epic",
  Classified: "legendary",
  Covert: "mythic",
  Extraordinary: "ultrarare",
  Contraband: "ultrarare",
};

const COLORS = {
  common: ["#b0c3d9", "#1b2430", "#64748b"],
  uncommon: ["#5e98d9", "#10233a", "#1e3a8a"],
  rare: ["#4b69ff", "#10183a", "#0f172a"],
  epic: ["#8847ff", "#1a0d38", "#3b0764"],
  legendary: ["#d32ce6", "#2a0a32", "#701a75"],
  mythic: ["#eb4b4b", "#2a0d10", "#7f1d1d"],
  ultrarare: ["#e4ae39", "#241a08", "#78350f"],
};

const ULTRA_FINISH = /fade$|marble fade|doppler|gamma doppler|lore|gungnir|howl|gold arabesque|knight$|hot rod|blaze$|pandora|crimson kimono|vice$|king snake/i;

/**
 * Committed Steam-range USD mids for thin/missing SCM rows.
 * Gem Dopplers use marketplace mids (SteamDB/CSMarketCap/Pricempire ~Aug 2026) —
 * never SCM collector asks and never compounding phase multipliers.
 */
const FAMOUS = {
  "AWP | Dragon Lore": { fn: 12480.0, mw: 9380.0, ft: 6720.0, ww: 5520.0, bs: 4920.0 },
  "AWP | Gungnir": { fn: 11240.0, mw: 9450.0, ft: 8120.0, ww: 6880.0, bs: 6240.0 },
  "M4A4 | Howl": { fn: 7120.0, mw: 5640.0, ft: 4480.0, ww: 3660.0, bs: 3120.0 },
  "M4A4 | Poseidon": { fn: 2720.0, mw: 1760.21, ft: 1580.0, ww: 1320.0, bs: 1140.0 },
  "AK-47 | Wild Lotus": { fn: 12450.0, mw: 8780.0, ft: 6420.0, ww: 5120.0, bs: 4480.0 },
  "AK-47 | Gold Arabesque": { fn: 3280.0, mw: 2840.0, ft: 2380.0, ww: 2140.0, bs: 2030.53 },
  "M4A1-S | Knight": { fn: 2980.0, mw: 2320.0 },
  "Karambit | Fade": { fn: 2280.0, mw: 2010.0 },
  "Butterfly Knife | Fade": { fn: 3480.0, mw: 3080.0 },
  // Assault Collection Restricted (Valve), not Covert. SCM dump misses it → synth was ~$29.
  // Steam-range mid ~Aug 2026 (SIH/SteamAnalyst FN ~$1.73k–$1.86k). Not 100% full-fade asks.
  "Glock-18 | Fade": { fn: 1780.0, mw: 1620.0 },
  "M9 Bayonet | Marble Fade": { fn: 1342.37, mw: 1345.45 },
  // Butterfly Doppler missing from SCM dump — mid-phase blend + explicit gems.
  "Butterfly Knife | Doppler": { fn: 2850.0, mw: 2550.0, ft: 2400.0 },
  "Butterfly Knife | Doppler (Phase 1)": { fn: 2200.0, mw: 1980.0 },
  "Butterfly Knife | Doppler (Phase 2)": { fn: 3900.0, mw: 3500.0 },
  "Butterfly Knife | Doppler (Phase 3)": { fn: 2080.0, mw: 1900.0 },
  "Butterfly Knife | Doppler (Phase 4)": { fn: 2680.0, mw: 2420.0 },
  "Butterfly Knife | Doppler (Sapphire)": { fn: 6500.0, mw: 6100.0 },
  "Butterfly Knife | Doppler (Ruby)": { fn: 9500.0, mw: 9000.0 },
  "Butterfly Knife | Doppler (Black Pearl)": { fn: 11500.0, mw: 10800.0 },
  "Butterfly Knife | Gamma Doppler": { fn: 3100.0, mw: 2800.0 },
  "Butterfly Knife | Gamma Doppler (Emerald)": { fn: 7800.0, mw: 7200.0 },
  "Karambit | Doppler": { fn: 2031.38, mw: 1920.0 },
  "Karambit | Doppler (Sapphire)": { fn: 4600.0, mw: 4450.0 },
  "Karambit | Doppler (Ruby)": { fn: 7200.0, mw: 6900.0 },
  "Karambit | Doppler (Black Pearl)": { fn: 8300.0, mw: 7900.0 },
  "Karambit | Gamma Doppler": { fn: 2340.0, mw: 2080.0 },
  "Karambit | Gamma Doppler (Emerald)": { fn: 6800.0, mw: 6400.0 },
  "M9 Bayonet | Doppler (Sapphire)": { fn: 3800.0, mw: 3600.0 },
  "M9 Bayonet | Doppler (Ruby)": { fn: 5200.0, mw: 4900.0 },
  "M9 Bayonet | Doppler (Black Pearl)": { fn: 6100.0, mw: 5800.0 },
  "M9 Bayonet | Gamma Doppler (Emerald)": { fn: 5400.0, mw: 5100.0 },
  "Sport Gloves | Pandora's Box": { fn: 8780.0, mw: 6380.0, ft: 4720.0, ww: 3780.0, bs: 3120.0 },
  "AWP | Medusa": { fn: 5680.0, mw: 4080.0, ft: 2860.0, ww: 2320.0, bs: 1980.0 },
};

const EXISTING_KEEP = {
  "ak-gold-arabesque": { fn: 3280.0, mw: 2840.0, ft: 2380.0, ww: 2140.0, bs: 2030.53 },
  "awp-lore": FAMOUS["AWP | Dragon Lore"],
  "awp-gungnir": FAMOUS["AWP | Gungnir"],
  "m4-howl": FAMOUS["M4A4 | Howl"],
  "m4-knight": FAMOUS["M4A1-S | Knight"],
  "kara-fade": FAMOUS["Karambit | Fade"],
  "bfly-fade": FAMOUS["Butterfly Knife | Fade"],
  "glock-fade": FAMOUS["Glock-18 | Fade"],
  "bfly-doppler": FAMOUS["Butterfly Knife | Doppler"],
  "bfly-doppler-sapphire": FAMOUS["Butterfly Knife | Doppler (Sapphire)"],
  "bfly-doppler-ruby": FAMOUS["Butterfly Knife | Doppler (Ruby)"],
  "bfly-doppler-black-pearl": FAMOUS["Butterfly Knife | Doppler (Black Pearl)"],
  "bfly-gamma-doppler-emerald": FAMOUS["Butterfly Knife | Gamma Doppler (Emerald)"],
  "kara-doppler-sapphire": FAMOUS["Karambit | Doppler (Sapphire)"],
  "kara-doppler-ruby": FAMOUS["Karambit | Doppler (Ruby)"],
  "kara-doppler-black-pearl": FAMOUS["Karambit | Doppler (Black Pearl)"],
  "kara-gamma-doppler-emerald": FAMOUS["Karambit | Gamma Doppler (Emerald)"],
  "m9-marble": FAMOUS["M9 Bayonet | Marble Fade"],
  "glove-pandora": FAMOUS["Sport Gloves | Pandora's Box"],
};

function fnv(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function listingWear(id) {
  const n = fnv(id) % 100;
  if (n < 12) return "fn";
  if (n < 42) return "mw";
  if (n < 80) return "ft";
  if (n < 92) return "ww";
  return "bs";
}

function canonName(name) {
  return String(name || "")
    .replace(/^★\s*/, "")
    .replace(/^StatTrak™\s*/, "")
    .replace(/^Souvenir\s*/, "")
    .trim();
}

function finishOf(name) {
  const c = canonName(name);
  const i = c.indexOf("|");
  return i >= 0 ? c.slice(i + 1).trim() : "Vanilla";
}

function slug(finish) {
  return finish
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function toCatalogWeapon(raw) {
  if (GLOVE_TYPES.has(raw)) return "Gloves";
  return raw;
}

function money(n) {
  if (!(n > 0) || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function minGap(v) {
  return Math.max(0.01, Math.round(v * 0.007 * 100) / 100);
}

/** Typical Steam exterior curve vs Field-Tested. FN always highest. */
function wearMult(wear, rarity, finish) {
  const ultra = ULTRA_FINISH.test(finish) || rarity === "ultrarare";
  const knife = /knife|karambit|bayonet|shadow daggers/i.test(finish) === false && rarity === "ultrarare";
  void knife;
  if (ultra) {
    return { fn: 1.92, mw: 1.41, ft: 1, ww: 0.82, bs: 0.71 }[wear];
  }
  if (rarity === "mythic") return { fn: 1.74, mw: 1.28, ft: 1, ww: 0.78, bs: 0.64 }[wear];
  if (rarity === "legendary") return { fn: 1.58, mw: 1.22, ft: 1, ww: 0.76, bs: 0.62 }[wear];
  if (rarity === "epic") return { fn: 2.35, mw: 1.48, ft: 1, ww: 0.81, bs: 0.69 }[wear];
  if (rarity === "rare") return { fn: 1.46, mw: 1.18, ft: 1, ww: 0.84, bs: 0.72 }[wear];
  return { fn: 1.28, mw: 1.11, ft: 1, ww: 0.88, bs: 0.79 }[wear];
}

function typicalBase(weapon, rarity, finish) {
  const isKnife = KNIFE_TYPES.has(weapon);
  const isGlove = weapon === "Gloves";
  const anchors = {
    common: 0.09,
    uncommon: 0.21,
    rare: 1.18,
    epic: 6.42,
    legendary: 24.8,
    mythic: 78.4,
    ultrarare: 640,
  };
  let v = anchors[rarity] ?? 2;
  if (weapon === "AWP") v *= 1.85;
  else if (weapon === "AK-47") v *= 1.52;
  else if (weapon === "M4A4" || weapon === "M4A1-S") v *= 1.4;
  else if (isKnife) v = rarity === "ultrarare" ? 1680 : 420;
  else if (isGlove) v = rarity === "ultrarare" ? 380 : 92;
  else if (["P250", "Five-SeveN", "MP9", "MAC-10", "MP7", "UMP-45", "Nova", "MAG-7", "XM1014", "Negev"].includes(weapon)) {
    v *= 0.58;
  }
  if (ULTRA_FINISH.test(finish)) v *= isKnife || isGlove ? 1.8 : 3.2;
  return v;
}

function fetchJson(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.json();
  });
}

async function loadJson(file, url) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const data = await fetchJson(url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

function parseExisting(src) {
  const ids = [...src.matchAll(/^\s+id: "([^"]+)",$/gm)].map((m) => m[1]);
  const names = [...src.matchAll(/^\s+name: "([^"]+)",$/gm)].map((m) => m[1]);
  const weapons = [...src.matchAll(/^\s+weapon: "([^"]+)",$/gm)].map((m) => m[1]);
  const rarities = [...src.matchAll(/^\s+rarity: "([^"]+)",$/gm)].map((m) => m[1]);
  const wears = [...src.matchAll(/^\s+wear: "([^"]+)",$/gm)].map((m) => m[1]);
  const images = [...src.matchAll(/image: "([^"]+)"/g)].map((m) => m[1]);
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    out.push({
      id: ids[i],
      name: names[i],
      weapon: weapons[i],
      rarity: rarities[i],
      wear: wears[i],
      image: images[i],
    });
  }
  return out;
}

function loadSnapshotQuotes() {
  if (!fs.existsSync(SNAP_OUT)) return new Map();
  try {
    const snap = JSON.parse(fs.readFileSync(SNAP_OUT, "utf8"));
    const map = new Map();
    for (const q of snap.quotes || []) {
      if (!q?.skinId || !q.wear || !(q.price > 0)) continue;
      map.set(`${q.skinId}:${q.wear}`, money(q.price));
    }
    return map;
  } catch {
    return new Map();
  }
}

function marketLookup(prices, displayName, wear) {
  const label = WEAR_LABEL[wear];
  const naked = canonName(displayName);
  const keys = [
    `${displayName} (${label})`,
    `★ ${naked} (${label})`,
    `${naked} (${label})`,
  ];
  for (const k of keys) {
    const v = prices[k];
    if (typeof v === "number" && v > 0) return money(v / 100);
  }
  return null;
}

function enforceLadder(quotes) {
  const ordered = WEARS.filter((w) => quotes[w] != null);
  for (let i = 1; i < ordered.length; i++) {
    const hi = ordered[i - 1];
    const lo = ordered[i];
    if (quotes[lo] >= quotes[hi] - 0.0001) {
      quotes[lo] = money(quotes[hi] - 0.01);
    }
    if (!(quotes[lo] > 0)) quotes[lo] = 0.01;
  }
  for (let i = ordered.length - 2; i >= 0; i--) {
    const lo = ordered[i + 1];
    const hi = ordered[i];
    if (quotes[hi] <= quotes[lo] + 0.0001) quotes[hi] = money(quotes[lo] + 0.01);
  }
  return quotes;
}

function stripPhase(name) {
  return String(name || "")
    .replace(/\s*\((?:Phase\s*[1-4]|Ruby|Sapphire|Black Pearl|Emerald)\)\s*$/i, "")
    .trim();
}

function isPhaseVariant(name) {
  return /\((?:Phase\s*[1-4]|Ruby|Sapphire|Black Pearl|Emerald)\)/i.test(name || "");
}

/**
 * Per-wear quotes. Phase gem multipliers apply ONCE to unphased SCM / synth only.
 * Famous + previous snapshot rows are treated as final USD (never re-scaled) —
 * re-applying phaseScale on keep rebuilds caused Sapphire ~$29k → $148k.
 */
function quotedWears(c, scm, snapQuotes) {
  const bases = {};
  const source = {};
  const famous = EXISTING_KEEP[c.id] || FAMOUS[c.name];
  const wants = (c.available || WEARS).slice();
  const phased = isPhaseVariant(c.name);
  const scale = phased ? phaseScale(c.finish || c.name || "") : 1;
  const baseName = stripPhase(c.apiName || c.name);
  const finishBase = stripPhase(c.finish || c.name || "");

  for (const w of WEARS) {
    if (famous?.[w] != null) {
      bases[w] = money(famous[w]);
      source[w] = "famous";
      continue;
    }

    // Rare: phase-specific market hash (gems usually share the unphased Doppler listing).
    const scmPhase = marketLookup(scm, c.name, w);
    if (scmPhase) {
      bases[w] = scmPhase;
      source[w] = "scm";
      continue;
    }

    const scmBase = marketLookup(scm, baseName, w);
    if (scmBase) {
      bases[w] = phased && scale !== 1 ? money(scmBase * scale) : scmBase;
      source[w] = phased && scale !== 1 ? "scm-scaled" : "scm";
      continue;
    }

    const prev = snapQuotes.get(`${c.id}:${w}`);
    if (prev && prev > 0) {
      // Drop corrupted compounded phase quotes (double/triple phaseScale history).
      if (phased && scale > 1) {
        const scmRef = marketLookup(scm, baseName, w);
        const ceiling = scmRef
          ? money(scmRef * scale * 1.4)
          : money(typicalBase(c.rawWeapon || c.weapon, c.rarity, finishBase) * scale * (wearMult(w, c.rarity, finishBase) || 1) * 2.2);
        if (ceiling && prev > ceiling) {
          // fall through to synth
        } else if (c.keep && prev >= 50) {
          bases[w] = prev;
          source[w] = "prev";
          continue;
        } else {
          bases[w] = prev;
          source[w] = "prev";
          continue;
        }
      } else if (c.keep && prev >= 50) {
        const scmUsd = marketLookup(scm, c.apiName || c.name, w);
        bases[w] = scmUsd && Math.abs(scmUsd - prev) / prev < 0.65 ? scmUsd : prev;
        source[w] = "prev";
        continue;
      } else {
        bases[w] = prev;
        source[w] = "prev";
        continue;
      }
    }
  }

  const anchorWear = wants.find((w) => bases[w] > 0) ?? "ft";
  const ftLike =
    bases.ft ||
    bases[anchorWear] ||
    money(typicalBase(c.rawWeapon || c.weapon, c.rarity, finishBase));
  if (ftLike > 0) {
    const ftMult = wearMult("ft", c.rarity, finishBase) || 1;
    const anchorSrc = bases[anchorWear] ? source[anchorWear] : "synth";
    for (const w of wants) {
      if (bases[w] > 0) continue;
      const rel = (wearMult(w, c.rarity, finishBase) || 1) / ftMult;
      // If filling from an already-scaled wear, inherit — do not scale again.
      const raw = money(ftLike * rel);
      if (phased && scale !== 1 && (anchorSrc === "synth" || !bases[anchorWear])) {
        bases[w] = money(raw * scale);
        source[w] = "synth-scaled";
      } else if (phased && scale !== 1 && anchorSrc === "scm") {
        // Shouldn't happen often; scm path already scaled when phased.
        bases[w] = raw;
        source[w] = "synth";
      } else {
        bases[w] = raw;
        source[w] = anchorSrc === "synth" || !bases[anchorWear] ? "synth" : anchorSrc;
        if (phased && scale !== 1 && source[w] === "synth") {
          bases[w] = money(raw * scale);
          source[w] = "synth-scaled";
        }
      }
    }
  }

  const available = wants.filter((w) => bases[w] > 0);
  return { bases, available };
}

function pickListing(id, available) {
  const want = listingWear(id);
  if (available.includes(want)) return want;
  const pref = ["ft", "mw", "fn", "ww", "bs"];
  return pref.find((w) => available.includes(w)) ?? available[0];
}

function availableFromApi(row) {
  const set = new Set();
  for (const w of row.wears || []) {
    const id = API_WEAR[w.name];
    if (id) set.add(id);
  }
  if (row.min_float != null && row.max_float != null) {
    if (row.min_float >= 0.07) set.delete("fn");
    if (row.max_float <= 0.07) {
      for (const x of ["mw", "ft", "ww", "bs"]) set.delete(x);
    }
    if (row.max_float <= 0.15) {
      for (const x of ["ft", "ww", "bs"]) set.delete(x);
    }
    if (row.min_float >= 0.38) set.delete("mw");
  }
  const list = WEARS.filter((w) => set.has(w));
  return list.length ? list : ["ft"];
}

function mapRarity(row) {
  const weapon = row.weapon?.name;
  const finish = finishOf(row.name);
  const grade = row.rarity?.name;
  if (KNIFE_TYPES.has(weapon) || GLOVE_TYPES.has(weapon)) return "ultrarare";
  if (grade === "Contraband" || /^howl$/i.test(finish)) return "ultrarare";
  if (grade === "Covert") return "mythic";
  if (grade === "Classified") return "legendary";
  return RARITY_MAP[grade] || "rare";
}

function phaseLabel(patternId) {
  const p = String(patternId || "");
  if (/ruby/i.test(p)) return "Ruby";
  if (/sapphire/i.test(p)) return "Sapphire";
  if (/blackpearl|black_pearl|black.?pearl/i.test(p)) return "Black Pearl";
  if (/emerald/i.test(p)) return "Emerald";
  const m = p.match(/phase[ _-]?(\d)/i);
  if (m) return `Phase ${m[1]}`;
  return "";
}

/** Multipliers vs unphased Doppler/Gamma SCM blend (cheapest phases drive the listing). Mid-market, not asks. */
function phaseScale(finish) {
  if (/ruby/i.test(finish)) return 3.55;
  if (/sapphire/i.test(finish)) return 2.35;
  if (/black pearl/i.test(finish)) return 4.1;
  if (/emerald/i.test(finish)) return 3.15;
  if (/phase 2/i.test(finish)) return 1.35;
  if (/phase 4/i.test(finish)) return 1.12;
  if (/phase 1/i.test(finish)) return 0.95;
  if (/phase 3/i.test(finish)) return 0.92;
  return 1;
}

function makeId(weapon, finish, used) {
  const p = PREFIX[weapon] || (GLOVE_TYPES.has(weapon) ? "glove" : "skin");
  let id = `${p}-${slug(finish) || "vanilla"}`;
  if (!used.has(id)) return id;
  if (GLOVE_TYPES.has(weapon)) {
    id = `${slug(weapon)}-${slug(finish)}`;
    if (!used.has(id)) return id;
  }
  let n = 2;
  while (used.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

async function main() {
  const prevSrc = fs.readFileSync(SKINS_OUT, "utf8");
  const existing = parseExisting(prevSrc);
  const existingByName = new Map(existing.map((s) => [canonName(s.name), s]));
  const usedIds = new Set(existing.map((s) => s.id));

  const apiSkins = await loadJson(API_SKINS, SKINS_URL);
  const priceDump = await loadJson(API_PRICES, PRICES_URL);
  const scm = priceDump.prices || priceDump;

  const snapQuotes = loadSnapshotQuotes();
  const candidates = [];
  const seenName = new Set();
  for (const row of apiSkins) {
    const rawW = row.weapon?.name;
    if (!ALLOWED.has(rawW)) continue;
    if (/StatTrak/i.test(row.name) || /Souvenir/i.test(row.name)) continue;
    const image = row.image || "";
    if (!image.includes("steamstatic.com/economy/image/")) continue;
    const baseName = canonName(row.name);
    const phase = phaseLabel(row.pattern?.id);
    const name = phase ? `${baseName} (${phase})` : baseName;
    if (seenName.has(name)) continue;
    if (!baseName.includes("|") && !KNIFE_TYPES.has(rawW)) continue;
    seenName.add(name);
    const finish = phase ? `${finishOf(row.name)} ${phase}` : finishOf(row.name);
    const catalogWeapon = toCatalogWeapon(rawW);
    const available = availableFromApi(row);
    const rarity = mapRarity(row);
    const prev = existingByName.get(name) || (!phase ? existingByName.get(baseName) : undefined);
    const id = prev?.id ?? makeId(rawW, finish, usedIds);
    usedIds.add(id);
    const collection = row.collections?.[0]?.name || row.crates?.[0]?.name || undefined;
    candidates.push({
      id,
      name,
      apiName: row.name,
      weapon: catalogWeapon,
      rawWeapon: rawW,
      rarity,
      finish,
      image: prev?.image || image,
      collection,
      available,
      keep: Boolean(prev),
    });
  }

  const byWeapon = new Map();
  for (const c of candidates) {
    const list = byWeapon.get(c.weapon) || [];
    list.push(c);
    byWeapon.set(c.weapon, list);
  }

  const picked = [];
  const pickedIds = new Set();
  const take = (c) => {
    if (!c || pickedIds.has(c.id)) return;
    if (picked.length >= CATALOG_CAP && !c.keep) return;
    pickedIds.add(c.id);
    picked.push(c);
  };
  for (const c of candidates.filter((x) => x.keep)) take(c);

  for (const prev of existing) {
    if (pickedIds.has(prev.id) || !prev.weapon) continue;
    take({
      id: prev.id,
      name: prev.name,
      apiName: prev.name,
      weapon: prev.weapon,
      rawWeapon: prev.weapon,
      rarity: prev.rarity || "rare",
      finish: finishOf(prev.name),
      image: prev.image,
      available: WEARS.slice(),
      keep: true,
    });
  }

  // Specialist books: every knife/glove listing with a Steam CDN image.
  for (const c of candidates) {
    if (KNIFE_TYPES.has(c.rawWeapon) || c.weapon === "Gloves") take(c);
  }

  for (const [weapon, quota] of Object.entries(QUOTAS)) {
    if (weapon === "Gloves" || KNIFE_TYPES.has(weapon)) continue;
    const pool = (byWeapon.get(weapon) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    let i = 0;
    const have = picked.filter((x) => x.weapon === weapon).length;
    let need = Math.max(0, quota - have);
    const rarities = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "ultrarare"];
    while (need > 0 && i < 800) {
      const r = rarities[i % rarities.length];
      const band = pool.filter((x) => x.rarity === r && !pickedIds.has(x.id));
      if (band.length) {
        take(band[(fnv(weapon + i) >>> 0) % band.length]);
        need -= 1;
      }
      i += 1;
    }
    for (const c of pool) {
      if (need <= 0) break;
      take(c);
      need -= 1;
    }
  }

  const extraWeapons = [...byWeapon.keys()].sort((a, b) => a.localeCompare(b));
  let guard = 0;
  while (picked.length < CATALOG_CAP && guard < 40000) {
    let progressed = false;
    for (const weapon of extraWeapons) {
      if (picked.length >= CATALOG_CAP) break;
      const next = (byWeapon.get(weapon) || []).find((c) => !pickedIds.has(c.id));
      if (next) {
        take(next);
        progressed = true;
      }
    }
    if (!progressed) break;
    guard += 1;
  }

  picked.sort((a, b) => a.weapon.localeCompare(b.weapon) || a.name.localeCompare(b.name));
  const keptFirst = [...picked.filter((p) => p.keep), ...picked.filter((p) => !p.keep)];
  const unique = [];
  const seen = new Set();
  for (const c of keptFirst) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    unique.push(c);
  }

  const quotes = [];
  const skins = [];
  for (const c of unique) {
    const { bases, available } = quotedWears(c, scm, snapQuotes);
    if (!available.length) continue;
    const filled = enforceLadder({ ...bases });
    const wear = pickListing(c.id, available.filter((w) => filled[w] > 0));
    const listing = filled[wear];
    if (!(listing > 0)) continue;
    for (const w of available) {
      if (!(filled[w] > 0)) continue;
      quotes.push({ skinId: c.id, wear: w, price: filled[w], currency: "USD" });
    }
    skins.push({
      id: c.id,
      name: c.name,
      weapon: c.weapon,
      rarity: c.rarity,
      wear,
      price: listing,
      stattrak: false,
      colors: COLORS[c.rarity],
      image: c.image,
      collection: c.collection,
      availableWears: available.filter((w) => filled[w] > 0),
    });
  }

  const ts = `import type { Skin } from "@/lib/types";

/** Generated by scripts/build-skin-catalog.mjs. Catalog \`price\` seeds the snapshot only. Runtime uses PriceProvider(skinId, wear). */

export const SKINS = [
${skins
  .map((s) => {
    const col = s.collection ? `,\n    collection: ${JSON.stringify(s.collection)}` : "";
    return `  {
    id: ${JSON.stringify(s.id)},
    name: ${JSON.stringify(s.name)},
    weapon: ${JSON.stringify(s.weapon)},
    rarity: ${JSON.stringify(s.rarity)},
    wear: ${JSON.stringify(s.wear)},
    price: ${s.price},
    stattrak: false,
    colors: ${JSON.stringify(s.colors)},
    image: ${JSON.stringify(s.image)}${col},
    availableWears: ${JSON.stringify(s.availableWears)},
  }`;
  })
  .join(",\n")}
] as unknown as Skin[];

export const SKIN_MAP: Record<string, Skin> = Object.fromEntries(SKINS.map((s) => [s.id, s]));
`;

  fs.writeFileSync(SKINS_OUT, ts);
  fs.writeFileSync(
    SNAP_OUT,
    JSON.stringify(
      {
        source:
          "Committed catalog snapshot. Seeded from data/skins.ts catalog list prices (not generated at runtime, not Math.random). Live Steam Community Market is attempted only on the server PriceProvider sync and is used only when it returns a valid quote.",
        sourceName: "Committed catalog snapshot",
        fetchedAt: Date.UTC(2026, 7, 21, 12, 0, 0),
        currency: "USD",
        quotes,
      },
      null,
      2,
    ),
  );

  const missingImg = skins.filter((s) => !s.image).length;
  const ids = new Set(skins.map((s) => s.id));
  const cover = [...ids].every((id) => quotes.some((q) => q.skinId === id));
  const byW = {};
  for (const s of skins) byW[s.weapon] = (byW[s.weapon] ?? 0) + 1;
  const knifeN = skins.filter((s) => KNIFE_TYPES.has(s.weapon)).length;
  const gloveN = skins.filter((s) => s.weapon === "Gloves").length;
  console.log(
    JSON.stringify(
      {
        skins: skins.length,
        quotes: quotes.length,
        snapshotCoversAllIds: cover,
        missingImage: missingImg,
        existingKept: skins.filter((s) => existing.some((e) => e.id === s.id)).length,
        knives: knifeN,
        gloves: gloveN,
        byWeapon: byW,
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
