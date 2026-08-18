import { SKINS, SKIN_MAP } from "@/data/skins";
import {
  UPGRADE_MAX_CHANCE,
  UPGRADE_MIN_CHANCE,
  UPGRADE_RTP,
} from "@/lib/economy/config";
import { instantiateSkin } from "@/lib/game";
import {
  getSkinPrice,
  listingWearFor,
  requireMarketPrice,
} from "@/lib/services/prices/priceProvider";
import { secureId, secureUnit } from "@/lib/rewards/rng";
import type { InventoryItem, Skin, Wear } from "@/lib/types";
import { clamp } from "@/lib/utils";

function extraStakeOf(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value <= 0) return 0;
  return +value.toFixed(2);
}

export type PricedSkin = { skin: Skin; price: number };

export type UpgradePreview = {
  inputValue: number;
  targetValue: number;
  chance: number;
  multiplier: number;
  rtp: number;
};

/** Relative price window when snapping x2/x5/x20 and percent chips to a catalog skin. */
const TARGET_PRICE_BAND = 0.4;

/**
 * Independent upgrade engine (not mixed with case RTP).
 * Chance = SUM(input market prices) / target market price × UPGRADE_RTP, then capped at max.
 * Not floored to UPGRADE_MIN_CHANCE — 1–9% hail-mary stays the honest formula.
 */
export function computeUpgradeChance(inputValue: number, targetValue: number): number {
  if (!(inputValue > 0) || !(targetValue > 0)) return 0;
  const raw = (inputValue / targetValue) * 100 * UPGRADE_RTP;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return +clamp(raw, 0.01, UPGRADE_MAX_CHANCE).toFixed(2);
}

export function formatUpgradeChance(chance: number): string {
  if (!Number.isFinite(chance) || chance <= 0) return "";
  return `${chance.toFixed(2)}%`;
}

export function isPlayableUpgradeChance(chance: number): boolean {
  return (
    Number.isFinite(chance) &&
    chance >= UPGRADE_MIN_CHANCE - 0.009 &&
    chance <= UPGRADE_MAX_CHANCE + 0.009
  );
}

export function impliedTargetValue(inputValue: number, chancePct: number): number {
  if (!(inputValue > 0) || !(chancePct > 0)) return 0;
  return +((inputValue * 100 * UPGRADE_RTP) / chancePct).toFixed(2);
}

export function impliedChanceFromMultiplier(multiplier: number): number {
  if (!(multiplier > 0)) return 0;
  return computeUpgradeChance(1, multiplier);
}

export function pricedCatalog(): PricedSkin[] {
  return SKINS.map((skin) => {
    const listed = getSkinPrice(skin.id);
    if (listed.available && listed.price != null) return { skin, price: listed.price };
    const worn = getSkinPrice(skin.id, skin.wear);
    return worn.available && worn.price != null ? { skin, price: worn.price } : null;
  }).filter((row): row is PricedSkin => !!row);
}

function foldSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Token search across weapon + finish + collection + id.
 * "ak asiimov" and "ak-47 | Asiimov" both hit `AK-47 | Asiimov`.
 */
export function matchesQuery(skin: Pick<Skin, "id" | "name" | "weapon" | "collection">, q: string) {
  const tokens = foldSearch(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const folded = foldSearch([skin.name, skin.weapon, skin.collection ?? "", skin.id].join(" "));
  const compact = folded.replace(/\s+/g, "");
  return tokens.every((token) => folded.includes(token) || compact.includes(token));
}

function playableAboveInput(inputValue: number): PricedSkin[] {
  if (!(inputValue > 0)) return [];
  return pricedCatalog().filter((row) => {
    if (!(row.price > inputValue * 1.01)) return false;
    return isPlayableUpgradeChance(computeUpgradeChance(inputValue, row.price));
  });
}

function chanceTolerance(desiredChance: number): number {
  return Math.max(1.25, Math.min(8, desiredChance * 0.28));
}

/**
 * Snap chips to a real catalog skin near the requested price / chance / multiplier.
 * If nothing sits in the tight band, fall back to the nearest playable catalog skin
 * (so 3%/5% still work on high-tier stakes). Null only when no playable target exists.
 */
export function findUpgradeTarget(input: {
  inputValue: number;
  desiredPrice?: number;
  desiredChance?: number;
  desiredMultiplier?: number;
}): PricedSkin | null {
  if (!(input.inputValue > 0)) return null;
  const pool = playableAboveInput(input.inputValue);
  if (!pool.length) return null;

  let desiredPrice = input.desiredPrice ?? 0;
  if (input.desiredChance && input.desiredChance > 0) {
    desiredPrice = impliedTargetValue(input.inputValue, input.desiredChance);
  } else if (input.desiredMultiplier && input.desiredMultiplier > 0) {
    desiredPrice = +(input.inputValue * input.desiredMultiplier).toFixed(2);
  }
  if (!(desiredPrice > 0)) return null;

  const desiredChance =
    input.desiredChance && input.desiredChance > 0
      ? input.desiredChance
      : computeUpgradeChance(input.inputValue, desiredPrice);
  const band = chanceTolerance(desiredChance);

  const inRange = pool.filter((row) => {
    const chance = computeUpgradeChance(input.inputValue, row.price);
    const priceRel = Math.abs(row.price - desiredPrice) / desiredPrice;
    const chanceDelta = Math.abs(chance - desiredChance);
    return priceRel <= TARGET_PRICE_BAND || chanceDelta <= band;
  });
  const ranked = (inRange.length ? inRange : pool).reduce((best, row) =>
    Math.abs(row.price - desiredPrice) < Math.abs(best.price - desiredPrice) ? row : best,
  );
  return ranked ?? null;
}

export function nearestUpgradeTarget(desiredPrice: number, inputValue: number): PricedSkin | null {
  return findUpgradeTarget({ inputValue, desiredPrice });
}

/** Random playable catalog skin above the current stake. */
export function randomUpgradeTarget(inputValue: number): PricedSkin | null {
  const pool = playableAboveInput(inputValue);
  if (!pool.length) return null;
  return pool[Math.floor(secureUnit() * pool.length)] ?? null;
}

export function previewUpgrade(
  sourceSkinIds: string[],
  targetSkinId: string,
  extraStake = 0,
  sourceWears?: Wear[],
  targetWear?: Wear,
): UpgradePreview {
  if (!sourceSkinIds.length) throw new Error("NO_SOURCES");
  if (!targetSkinId) throw new Error("NO_TARGET");
  if (sourceWears?.length && sourceWears.length !== sourceSkinIds.length) {
    throw new Error("SOURCE_MISMATCH");
  }
  const extra = extraStakeOf(extraStake);
  const skinsValue = +sourceSkinIds
    .reduce((sum, id, i) => sum + requireMarketPrice(id, sourceWears?.[i]), 0)
    .toFixed(2);
  const inputValue = +(skinsValue + extra).toFixed(2);
  const quotedWear = targetWear ?? listingWearFor(targetSkinId);
  const targetValue = requireMarketPrice(targetSkinId, quotedWear);
  if (!(targetValue > inputValue)) throw new Error("DOWNGRADE_BLOCKED");
  const chance = computeUpgradeChance(inputValue, targetValue);
  if (chance <= 0) throw new Error("CHANCE_UNAVAILABLE");
  return {
    inputValue,
    targetValue,
    chance,
    multiplier: +(targetValue / inputValue).toFixed(2),
    rtp: UPGRADE_RTP,
  };
}

export function resolveUpgrade(input: {
  sourceSkinIds: string[];
  targetSkinId: string;
  requestedChance: number;
  extraStake?: number;
  sourceWears?: Wear[];
  targetWear?: Wear;
}): UpgradePreview & {
  success: boolean;
  item: InventoryItem | null;
  min: number;
  max: number;
  extraStake: number;
} {
  const extraStake = extraStakeOf(input.extraStake);
  const quotedWear = input.targetWear ?? listingWearFor(input.targetSkinId);
  const preview = previewUpgrade(
    input.sourceSkinIds,
    input.targetSkinId,
    extraStake,
    input.sourceWears,
    quotedWear,
  );
  const requested = +Number(input.requestedChance).toFixed(2);
  if (!Number.isFinite(requested) || requested > UPGRADE_MAX_CHANCE + 0.009) {
    throw new Error("CHANCE_TOO_HIGH");
  }
  if (Math.abs(requested - preview.chance) > 0.05) {
    throw new Error(`CHANCE_MISMATCH:${preview.chance}`);
  }
  if (preview.chance < UPGRADE_MIN_CHANCE - 0.009) {
    throw new Error("CHANCE_TOO_LOW");
  }
  if (preview.chance > UPGRADE_MAX_CHANCE + 0.009) {
    throw new Error("CHANCE_TOO_HIGH");
  }
  const target = SKIN_MAP[input.targetSkinId];
  if (!target) throw new Error("UNKNOWN_TARGET");
  const success = secureUnit() * 100 < preview.chance;
  return {
    ...preview,
    extraStake,
    min: UPGRADE_MIN_CHANCE,
    max: UPGRADE_MAX_CHANCE,
    success,
    item: success
      ? instantiateSkin(target, {
          wear: quotedWear,
          price: preview.targetValue,
          instanceId: secureId("itm"),
        })
      : null,
  };
}

/** @deprecated use computeUpgradeChance */
export function upgradeChance(fromPrice: number, toPrice: number) {
  return Math.round(computeUpgradeChance(fromPrice, toPrice));
}

export function chanceWindow(fromPrice: number, toPrice: number) {
  const base = computeUpgradeChance(fromPrice, toPrice);
  return { base, min: UPGRADE_MIN_CHANCE, max: UPGRADE_MAX_CHANCE };
}
