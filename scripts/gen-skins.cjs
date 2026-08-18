const fs = require("fs");
const skins = require("/tmp/cs2-skins.json");

const PRICE = {
  "ak-neon": 48.2,
  "ak-fire": 628,
  "ak-asiimov": 86.4,
  "ak-redline": 18.9,
  "ak-vulcan": 74.5,
  "ak-inherit": 33.8,
  "ak-slate": 4.2,
  "ak-elite": 1.15,
  "ak-bloodsport": 58,
  "ak-case-hardened": 142,
  "ak-gold-arabesque": 2650,
  "m4s-printstream": 196,
  "m4-print": 196,
  "m4-hyper": 42.6,
  "m4-player": 21.4,
  "m4-knight": 2840,
  "m4-phos": 318,
  "m4-nitro": 0.92,
  "m4s-golden-coil": 88,
  "m4s-cyrex": 36,
  "m4s-hot-rod": 410,
  "m4-asiimov": 64,
  "m4-howl": 6200,
  "m4-the-emperor": 92,
  "m4-neo-noir": 28,
  "m4-desolate-space": 22,
  "m4-temukau": 118,
  "awp-lore": 8650,
  "awp-asiimov": 112,
  "awp-contain": 426,
  "awp-neonoir": 38.9,
  "awp-atheris": 8.6,
  "awp-worm": 2.45,
  "awp-safari": 0.38,
  "awp-gungnir": 9100,
  "awp-fade": 980,
  "awp-lightning-strike": 540,
  "usp-print": 54.8,
  "usp-kill": 96.5,
  "usp-orion": 16.4,
  "usp-cortex": 3.25,
  "usp-leaves": 0.22,
  "usp-the-traitor": 72,
  "usp-neo-noir": 19.4,
  "glock-water": 6.7,
  "glock-fade": 328,
  "glock-vogue": 14.2,
  "glock-galaxy": 28.4,
  "glock-sand": 0.14,
  "glock-wasteland-rebel": 18,
  "glock-gamma-doppler": 210,
  "deag-blaze": 386,
  "deag-code": 24.7,
  "deag-print": 88.3,
  "deag-conspiracy": 9.4,
  "deag-urban": 0.41,
  "deag-golden-koi": 64,
  "deag-kumicho-dragon": 21,
  "p250-see-ya-later": 16.8,
  "p250-asiimov": 9.4,
  "p250-muertos": 7.2,
  "p250-nuclear-threat": 88,
  "five-seven-fairy-tale": 12.4,
  "five-seven-hyper-beast": 6.8,
  "five-seven-case-hardened": 22,
  "mp9-starlight-protector": 18.6,
  "mp9-hydra": 9.1,
  "mp9-rose-iron": 3.4,
  "mac-10-neon-rider": 8.9,
  "mac-10-disco-tech": 6.1,
  "mac-10-heat": 2.8,
  "kara-fade": 2140,
  "kara-doppler": 892,
  "kara-crimson": 648,
  "kara-gamma": 964,
  "kara-night": 418,
  "bfly-fade": 3280,
  "bfly-doppler": 1420,
  "bfly-auto": 785,
  "bfly-urban": 322,
  "m9-marble": 1860,
  "m9-doppler": 728,
  "m9-crimson": 542,
  "m9-stained": 286,
  "glove-pandora": 4520,
  "glove-fade": 988,
  "glove-king": 426,
  "glove-mint": 194,
  "glove-leather": 86,
};

const IDS = {
  "AK-47 | Neon Rider": "ak-neon",
  "AK-47 | Fire Serpent": "ak-fire",
  "AK-47 | Asiimov": "ak-asiimov",
  "AK-47 | Redline": "ak-redline",
  "AK-47 | Vulcan": "ak-vulcan",
  "AK-47 | Inheritance": "ak-inherit",
  "AK-47 | Slate": "ak-slate",
  "AK-47 | Elite Build": "ak-elite",
  "M4A1-S | Printstream": "m4-print",
  "M4A1-S | Hyper Beast": "m4-hyper",
  "M4A1-S | Player Two": "m4-player",
  "M4A1-S | Knight": "m4-knight",
  "M4A1-S | Blue Phosphor": "m4-phos",
  "M4A1-S | Nitro": "m4-nitro",
  "AWP | Dragon Lore": "awp-lore",
  "AWP | Asiimov": "awp-asiimov",
  "AWP | Containment Breach": "awp-contain",
  "AWP | Neo-Noir": "awp-neonoir",
  "AWP | Atheris": "awp-atheris",
  "AWP | Worm God": "awp-worm",
  "AWP | Safari Mesh": "awp-safari",
  "Glock-18 | Water Elemental": "glock-water",
  "Glock-18 | Fade": "glock-fade",
  "Glock-18 | Vogue": "glock-vogue",
  "Glock-18 | Twilight Galaxy": "glock-galaxy",
  "Glock-18 | Sand Dune": "glock-sand",
  "USP-S | Kill Confirmed": "usp-kill",
  "USP-S | Printstream": "usp-print",
  "USP-S | Orion": "usp-orion",
  "USP-S | Cortex": "usp-cortex",
  "USP-S | Forest Leaves": "usp-leaves",
  "Desert Eagle | Blaze": "deag-blaze",
  "Desert Eagle | Code Red": "deag-code",
  "Desert Eagle | Printstream": "deag-print",
  "Desert Eagle | Conspiracy": "deag-conspiracy",
  "Desert Eagle | Urban Rubble": "deag-urban",
  "Karambit | Fade": "kara-fade",
  "Karambit | Doppler": "kara-doppler",
  "Karambit | Crimson Web": "kara-crimson",
  "Karambit | Gamma Doppler": "kara-gamma",
  "Karambit | Night": "kara-night",
  "Butterfly Knife | Fade": "bfly-fade",
  "Butterfly Knife | Doppler": "bfly-doppler",
  "Butterfly Knife | Autotronic": "bfly-auto",
  "Butterfly Knife | Urban Masked": "bfly-urban",
  "M9 Bayonet | Marble Fade": "m9-marble",
  "M9 Bayonet | Doppler": "m9-doppler",
  "M9 Bayonet | Crimson Web": "m9-crimson",
  "M9 Bayonet | Stained": "m9-stained",
  "Sport Gloves | Pandora's Box": "glove-pandora",
  "Specialist Gloves | Fade": "glove-fade",
  "Driver Gloves | King Snake": "glove-king",
  "Moto Gloves | Cool Mint": "glove-mint",
  "Hand Wraps | Leather": "glove-leather",
};

const WANTED = [
  "AK-47 | Asiimov","AK-47 | Neon Rider","AK-47 | The Empress","AK-47 | Fire Serpent","AK-47 | Redline","AK-47 | Vulcan","AK-47 | Inheritance","AK-47 | Slate","AK-47 | Elite Build","AK-47 | Bloodsport","AK-47 | Case Hardened","AK-47 | Gold Arabesque",
  "M4A1-S | Printstream","M4A1-S | Hyper Beast","M4A1-S | Player Two","M4A1-S | Knight","M4A1-S | Blue Phosphor","M4A1-S | Nitro","M4A1-S | Golden Coil","M4A1-S | Cyrex","M4A1-S | Hot Rod",
  "M4A4 | Asiimov","M4A4 | Howl","M4A4 | The Emperor","M4A4 | Neo-Noir","M4A4 | Desolate Space","M4A4 | Temukau",
  "AWP | Asiimov","AWP | Dragon Lore","AWP | Containment Breach","AWP | Neo-Noir","AWP | Atheris","AWP | Worm God","AWP | Safari Mesh","AWP | Gungnir","AWP | Fade","AWP | Lightning Strike",
  "USP-S | Printstream","USP-S | Kill Confirmed","USP-S | Orion","USP-S | Cortex","USP-S | Forest Leaves","USP-S | The Traitor","USP-S | Neo-Noir",
  "Glock-18 | Water Elemental","Glock-18 | Fade","Glock-18 | Vogue","Glock-18 | Twilight Galaxy","Glock-18 | Sand Dune","Glock-18 | Wasteland Rebel","Glock-18 | Gamma Doppler",
  "Desert Eagle | Blaze","Desert Eagle | Code Red","Desert Eagle | Printstream","Desert Eagle | Conspiracy","Desert Eagle | Urban Rubble","Desert Eagle | Golden Koi","Desert Eagle | Kumicho Dragon",
  "P250 | See Ya Later","P250 | Asiimov","P250 | Muertos","P250 | Nuclear Threat",
  "Five-SeveN | Fairy Tale","Five-SeveN | Hyper Beast","Five-SeveN | Case Hardened",
  "MP9 | Starlight Protector","MP9 | Hydra","MP9 | Rose Iron",
  "MAC-10 | Neon Rider","MAC-10 | Disco Tech","MAC-10 | Heat",
  "Karambit | Fade","Karambit | Doppler","Karambit | Crimson Web","Karambit | Gamma Doppler","Karambit | Night",
  "Butterfly Knife | Fade","Butterfly Knife | Doppler","Butterfly Knife | Autotronic","Butterfly Knife | Urban Masked",
  "M9 Bayonet | Marble Fade","M9 Bayonet | Doppler","M9 Bayonet | Crimson Web","M9 Bayonet | Stained",
  "Sport Gloves | Pandora's Box","Specialist Gloves | Fade","Driver Gloves | King Snake","Moto Gloves | Cool Mint","Hand Wraps | Leather"
];

const RARITY = {
  "Consumer Grade": "common",
  "Industrial Grade": "uncommon",
  "Mil-Spec Grade": "rare",
  Restricted: "epic",
  Classified: "legendary",
  Covert: "mythic",
  Extraordinary: "ultrarare",
  Contraband: "ultrarare",
};

const PALETTE = {
  common: ["#78716c", "#a8a29e", "#292524"],
  uncommon: ["#34d399", "#334155", "#94a3b8"],
  rare: ["#38bdf8", "#1e3a8a", "#0f172a"],
  epic: ["#c084fc", "#4c1d95", "#22d3ee"],
  legendary: ["#fbbf24", "#111827", "#f97316"],
  mythic: ["#fb7185", "#7f1d1d", "#fbbf24"],
  ultrarare: ["#e879f9", "#22d3ee", "#ffc247"],
};

function slug(name) {
  if (IDS[name]) return IDS[name];
  const [w, f] = name.split(" | ");
  const wcode = {
    "AK-47": "ak",
    "M4A1-S": "m4s",
    "M4A4": "m4",
    "AWP": "awp",
    "USP-S": "usp",
    "Glock-18": "glock",
    "Desert Eagle": "deag",
    "P250": "p250",
    "Five-SeveN": "five-seven",
    "MP9": "mp9",
    "MAC-10": "mac-10",
    "Karambit": "kara",
    "Butterfly Knife": "bfly",
    "M9 Bayonet": "m9",
    "Sport Gloves": "glove",
    "Specialist Gloves": "glove",
    "Driver Gloves": "glove",
    "Moto Gloves": "glove",
    "Hand Wraps": "glove",
  };
  const finish = (f || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${wcode[w] || "skin"}-${finish}`;
}

function weaponOf(row) {
  const n = row.weapon?.name || "";
  if (row.category?.name === "Gloves" || n.includes("Gloves") || n.includes("Wraps")) return "Gloves";
  return n;
}

function priceOf(id, rarity, weapon) {
  if (PRICE[id]) return PRICE[id];
  const base = { common: 0.6, uncommon: 2.4, rare: 9, epic: 28, legendary: 82, mythic: 360, ultrarare: 1600 }[rarity];
  const mul = ["Karambit", "Butterfly Knife", "M9 Bayonet"].includes(weapon) ? 2.2 : weapon === "Gloves" ? 1.8 : weapon === "AWP" ? 1.35 : 1;
  return +(base * mul).toFixed(2);
}

const rows = [];
for (const name of WANTED) {
  const raw = skins.find((x) => x.name === name || x.name === "★ " + name);
  if (!raw) throw new Error("missing " + name);
  const id = slug(name);
  const rarity = ["Karambit", "Butterfly Knife", "M9 Bayonet"].includes(raw.weapon.name) || raw.category?.name === "Gloves"
    ? "ultrarare"
    : RARITY[raw.rarity?.name] || "rare";
  // knives covert in data - force high rarities by known names
  let r = RARITY[raw.rarity?.name] || "rare";
  if (raw.category?.name === "Gloves") r = r === "ultrarare" ? "ultrarare" : r === "mythic" ? "mythic" : "ultrarare";
  if (["Karambit", "Butterfly Knife", "M9 Bayonet"].includes(raw.weapon.name) && (r === "mythic" || r === "legendary" || r === "ultrarare" || r === "epic" || r === "covert")) {
    if (raw.rarity?.name === "Covert") r = name.includes("Fade") || name.includes("Marble") ? "ultrarare" : "mythic";
  }
  if (name.includes("Dragon Lore") || name.includes("Howl") || name.includes("Gungnir") || name.includes("Knight") || name.includes("Gold Arabesque") || name.includes("Pandora")) r = "ultrarare";
  if (name.includes("Fire Serpent") || name.includes("Blaze") || name.endsWith("Doppler") || name.includes("Containment")) if (r !== "ultrarare") r = "mythic";
  const weapon = weaponOf(raw);
  const collection = raw.collections?.[0]?.name || raw.crates?.[0]?.name || "The Prism Collection";
  const colors = PALETTE[r];
  rows.push({
    id,
    name,
    weapon,
    rarity: r,
    wear: "fn",
    price: priceOf(id, r, weapon),
    stattrak: false,
    colors,
    image: raw.image,
    collection,
  });
}

const used = new Set();
for (const row of rows) {
  if (used.has(row.id)) throw new Error("dup id " + row.id);
  used.add(row.id);
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const out = `import type { Skin } from "@/lib/types";

export const SKINS: Skin[] = [
${rows
  .map(
    (s) => `  {
    id: "${s.id}",
    name: "${esc(s.name)}",
    weapon: "${s.weapon}",
    rarity: "${s.rarity}",
    wear: "fn",
    price: ${s.price},
    stattrak: false,
    colors: ${JSON.stringify(s.colors)},
    image: "${s.image}",
    collection: "${esc(s.collection)}",
  }`,
  )
  .join(",\n")}
];

export const SKIN_MAP: Record<string, Skin> = Object.fromEntries(SKINS.map((s) => [s.id, s]));
`;

fs.mkdirSync("/Users/nazariipiks/Desktop/PrismLoot/data", { recursive: true });
fs.writeFileSync("/Users/nazariipiks/Desktop/PrismLoot/data/skins.ts", out);
console.log("wrote", rows.length, "skins");
