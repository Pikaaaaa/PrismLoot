import type { CSSProperties } from "react";
import type { Rarity, Wear } from "./types";

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "ultrarare",
];

/** Gold → Covert red → Classified pink → Restricted purple → Mil-Spec blue. */
export const RARITY_DESC: Rarity[] = [...RARITY_ORDER].reverse();

/** Steam / CS2 grade colors. No green, no rainbow. Gold is knives & Contraband only. */
export const RARITY_META: Record<Rarity, { label: string; color: string; glow: string; text: string }> = {
  common: {
    label: "Consumer",
    color: "#b0c3d9",
    glow: "rgba(176,195,217,0.12)",
    text: "text-slate-300",
  },
  uncommon: {
    label: "Industrial",
    color: "#5e98d9",
    glow: "rgba(94,152,217,0.12)",
    text: "text-sky-300",
  },
  rare: {
    label: "Mil-Spec",
    color: "#4b69ff",
    glow: "rgba(75,105,255,0.14)",
    text: "text-blue-300",
  },
  epic: {
    label: "Restricted",
    color: "#8847ff",
    glow: "rgba(136,71,255,0.14)",
    text: "text-violet-300",
  },
  legendary: {
    label: "Classified",
    color: "#d32ce6",
    glow: "rgba(211,44,230,0.14)",
    text: "text-fuchsia-300",
  },
  mythic: {
    label: "Covert",
    color: "#eb4b4b",
    glow: "rgba(235,75,75,0.16)",
    text: "text-red-300",
  },
  ultrarare: {
    label: "Gold",
    color: "#e4ae39",
    glow: "rgba(228,174,57,0.16)",
    text: "text-amber-200",
  },
};

export const RARITY_COLORS: Record<Rarity, [string, string, string]> = {
  common: ["#b0c3d9", "#1b2430", "#64748b"],
  uncommon: ["#5e98d9", "#10233a", "#1e3a8a"],
  rare: ["#4b69ff", "#10183a", "#0f172a"],
  epic: ["#8847ff", "#1a0d38", "#3b0764"],
  legendary: ["#d32ce6", "#2a0a32", "#701a75"],
  mythic: ["#eb4b4b", "#2a0d10", "#7f1d1d"],
  ultrarare: ["#e4ae39", "#241a08", "#78350f"],
};

export function rarityRank(r: Rarity) {
  return RARITY_ORDER.indexOf(r);
}

/** Highest rarity first, then price (expensive first by default). */
export function compareRarityThenPrice(
  a: { rarity: Rarity; price?: number | null },
  b: { rarity: Rarity; price?: number | null },
  priceDir: "asc" | "desc" = "desc",
) {
  const rarity = rarityRank(b.rarity) - rarityRank(a.rarity);
  if (rarity !== 0) return rarity;
  const pa = a.price ?? 0;
  const pb = b.price ?? 0;
  return priceDir === "asc" ? pa - pb : pb - pa;
}

export function groupByRarity<T extends { rarity: Rarity; price?: number | null }>(
  items: T[],
  priceDir: "asc" | "desc" = "desc",
) {
  return RARITY_DESC.flatMap((rarity) => {
    const rows = items.filter((item) => item.rarity === rarity);
    if (!rows.length) return [];
    const priced = rows.some((row) => row.price != null);
    const sorted = priced
      ? rows.slice().sort((a, b) => compareRarityThenPrice(a, b, priceDir))
      : rows;
    return [{ rarity, items: sorted }];
  });
}

export function rarityGlowStyle(rarity: Rarity): CSSProperties {
  return rarityChromeStyle(rarity);
}

/** Bottom hairline only. No L-shape, no neon inset. */
export function rarityChromeStyle(rarity: Rarity): CSSProperties {
  const meta = RARITY_META[rarity];
  const hot = isHighRarity(rarity);
  return {
    boxShadow: `inset 0 -1px 0 ${meta.color}${hot ? "cc" : "99"}`,
  };
}

export function rarityBandStyle(rarity: Rarity): CSSProperties {
  const meta = RARITY_META[rarity];
  return {
    borderColor: `${meta.color}33`,
    background: `linear-gradient(90deg, ${meta.color}18, transparent 34%)`,
  };
}

export const WEAR_META: Record<Wear, { label: string; short: string }> = {
  fn: { label: "Factory New", short: "FN" },
  mw: { label: "Minimal Wear", short: "MW" },
  ft: { label: "Field-Tested", short: "FT" },
  ww: { label: "Well-Worn", short: "WW" },
  bs: { label: "Battle-Scarred", short: "BS" },
};

export function isHighRarity(r: Rarity) {
  return r === "mythic" || r === "ultrarare";
}
