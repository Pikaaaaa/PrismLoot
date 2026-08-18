import { SKIN_MAP } from "@/data/skins";
import { CASE_MAP } from "@/data/cases";
import { instantiateSkin } from "@/lib/game";
import { requireMarketPrice } from "@/lib/services/prices/priceProvider";
import type { RolledCaseReward } from "@/lib/types";
import { secureId, weightedSecurePick } from "./rng";

/**
 * Independent case roll. Outcome depends only on crate.rewards weights.
 * Never SKINS global, never featuredReward-as-roll, never another crate.
 */
export function rollCase(caseId: string): RolledCaseReward {
  const crate = CASE_MAP[caseId];
  if (!crate) throw new Error(`Unknown case ${caseId}`);

  const pool = crate.rewards.filter((row) => row.chance > 0);
  if (!pool.length) throw new Error(`${crate.id}: empty reward weights`);

  const allowed = new Set(crate.rewards.map((row) => row.skinId));
  const hit = weightedSecurePick(pool);
  if (!allowed.has(hit.skinId)) {
    throw new Error(`${crate.id}: rolled ${hit.skinId} not in crate.rewards`);
  }

  const skin = SKIN_MAP[hit.skinId];
  if (!skin) throw new Error(`Skin missing for ${hit.skinId}`);

  const item = instantiateSkin(skin, {
    stattrak: false,
    instanceId: secureId("itm"),
    obtainedAt: Date.now(),
  });
  if (item.id !== hit.skinId) {
    throw new Error(`${crate.id}: instance remapped ${hit.skinId} → ${item.id}`);
  }
  const market = Number.isFinite(item.price) ? item.price : requireMarketPrice(hit.skinId, item.wear);

  return {
    caseId: crate.id,
    skinId: hit.skinId,
    chance: hit.chance,
    value: market,
    rarity: hit.rarity,
    item,
  };
}
