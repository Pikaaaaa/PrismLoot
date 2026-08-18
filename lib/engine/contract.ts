import { SKINS, SKIN_MAP } from "@/data/skins";
import { generateCaseWeights } from "@/lib/economy/balancer";
import {
  CONTRACT_MAX_ITEMS,
  CONTRACT_MIN_ITEMS,
  CONTRACT_POOL_HI,
  CONTRACT_POOL_LO,
  CONTRACT_RTP,
} from "@/lib/economy/config";
import { instantiateSkin } from "@/lib/game";
import { getSkinPrice, requireMarketPrice } from "@/lib/services/prices/priceProvider";
import { secureId, weightedSecurePick } from "@/lib/rewards/rng";
import type { CaseReward, InventoryItem, Skin } from "@/lib/types";

export type ContractPreview = {
  inputValue: number;
  ev: number;
  rtp: number;
  minReward: number;
  maxReward: number;
  rewards: Array<CaseReward & { skin: Skin }>;
};

function extraStakeOf(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value <= 0) return 0;
  return +value.toFixed(2);
}

function catalogQuotes() {
  return SKINS.map((skin) => {
    const quote = getSkinPrice(skin.id);
    return quote.available && quote.price != null ? { skin, value: quote.price } : null;
  }).filter((row): row is { skin: Skin; value: number } => !!row);
}

function pickSpread(sorted: Array<{ skin: Skin; value: number }>, n: number) {
  if (sorted.length <= n) return sorted;
  const out: Array<{ skin: Skin; value: number }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (sorted.length - 1)) / (n - 1));
    const row = sorted[idx];
    if (!seen.has(row.skin.id)) {
      seen.add(row.skin.id);
      out.push(row);
    }
  }
  for (const row of sorted) {
    if (out.length >= n) break;
    if (!seen.has(row.skin.id)) {
      seen.add(row.skin.id);
      out.push(row);
    }
  }
  return out;
}

function buildPool(inputValue: number) {
  const all = catalogQuotes().sort((a, b) => a.value - b.value);
  let lo = inputValue * CONTRACT_POOL_LO;
  let hi = inputValue * CONTRACT_POOL_HI;
  let band = all.filter((r) => r.value >= lo && r.value <= hi);
  if (band.length < 8) {
    lo = inputValue * 0.15;
    hi = inputValue * 5;
    band = all.filter((r) => r.value >= lo && r.value <= hi);
  }
  if (band.length < 4) band = all.slice();
  const loss = all.filter((r) => r.value < inputValue * 0.98);
  const win = all.filter((r) => r.value > inputValue * 1.02);
  if (!band.some((r) => r.value < inputValue * 0.98) && loss.length) band.unshift(loss[0]);
  if (!band.some((r) => r.value > inputValue * 1.02) && win.length) band.push(win[win.length - 1]);
  const unique = [...new Map(band.map((r) => [r.skin.id, r])).values()].sort((a, b) => a.value - b.value);
  return pickSpread(unique, 14);
}

/**
 * Independent contract engine. EV ≈ inputValue * CONTRACT_RTP.
 * Outcomes include cheaper and more expensive skins; never nearest-higher + rarity bump.
 */
export function previewContract(skinIds: string[], extraStake = 0): ContractPreview {
  if (skinIds.length < CONTRACT_MIN_ITEMS || skinIds.length > CONTRACT_MAX_ITEMS) {
    throw new Error(`CONTRACT_SIZE:${CONTRACT_MIN_ITEMS}-${CONTRACT_MAX_ITEMS}`);
  }
  const skinsValue = +skinIds.reduce((sum, id) => sum + requireMarketPrice(id), 0).toFixed(2);
  const inputValue = +(skinsValue + extraStakeOf(extraStake)).toFixed(2);
  const pool = buildPool(inputValue);
  if (pool.length < 2) throw new Error("CONTRACT_POOL_EMPTY");
  let weighted;
  try {
    weighted = generateCaseWeights(
      inputValue,
      CONTRACT_RTP,
      pool.map((row) => ({ skinId: row.skin.id, value: row.value, rarity: row.skin.rarity })),
    );
  } catch {
    const rest = 1 - 0.72;
    weighted = pool.map((row, i) => ({
      skinId: row.skin.id,
      value: row.value,
      rarity: row.skin.rarity,
      chance: i === 0 ? 72 : (rest / Math.max(1, pool.length - 1)) * 100,
      weight: 1,
    }));
  }
  const rewards = weighted
    .map((row) => ({ ...row, skin: SKIN_MAP[row.skinId] }))
    .filter((row) => row.skin)
    .sort((a, b) => a.value - b.value);
  const ev = +rewards.reduce((s, r) => s + (r.chance / 100) * r.value, 0).toFixed(2);
  return {
    inputValue,
    ev,
    rtp: CONTRACT_RTP,
    minReward: rewards[0]?.value ?? 0,
    maxReward: rewards[rewards.length - 1]?.value ?? 0,
    rewards,
  };
}

export function resolveContract(skinIds: string[], extraStake = 0): ContractPreview & {
  item: InventoryItem;
  rewardValue: number;
  profit: number;
} {
  const preview = previewContract(skinIds, extraStake);
  const hit = weightedSecurePick(preview.rewards);
  const skin = SKIN_MAP[hit.skinId];
  if (!skin) throw new Error("UNKNOWN_REWARD");
  const item = instantiateSkin(skin, {
    price: hit.value,
    instanceId: secureId("itm"),
  });
  return {
    ...preview,
    item,
    rewardValue: hit.value,
    profit: +(hit.value - preview.inputValue).toFixed(2),
  };
}
