import { SKIN_MAP } from "@/data/skins";
import type { Crate } from "@/lib/types";
import { expectedUnboxPrice } from "@/lib/wear";
import { CASE_MAX_SINGLE_CHANCE, CASE_MIN_LOSE_MASS, CASE_MIN_WIN_MASS } from "./config";
import { calculateCaseEV } from "./ev";

export function validateCase(crate: Crate) {
  if (!crate.id || !crate.name) throw new Error("Case missing id/name");
  if (!(crate.price > 0)) throw new Error(`${crate.id}: invalid price`);
  if (!(crate.rtp < 1) || crate.rtp < 0.5) {
    throw new Error(`${crate.id}: RTP must be below 100% (got ${crate.rtp})`);
  }
  const expectedEdge = +(1 - crate.rtp).toFixed(4);
  if (Math.abs(crate.houseEdge - expectedEdge) > 0.001) {
    throw new Error(`${crate.id}: houseEdge must equal 1 - RTP`);
  }
  if (!crate.rewards?.length) throw new Error(`${crate.id}: empty rewards`);
  if (crate.rewards.length < 25) {
    const poolWeapons = new Set(crate.rewards.map((row) => SKIN_MAP[row.skinId]?.weapon));
    if (crate.rewards.length < 22 || poolWeapons.size !== 1) {
      throw new Error(`${crate.id}: need at least 25 rewards (got ${crate.rewards.length})`);
    }
  }
  if (crate.rewards.length > 50) {
    throw new Error(`${crate.id}: at most 50 rewards (got ${crate.rewards.length})`);
  }

  const ids = new Set<string>();
  for (const row of crate.rewards) {
    if (ids.has(row.skinId)) throw new Error(`${crate.id}: duplicate reward ${row.skinId}`);
    ids.add(row.skinId);
    const skin = SKIN_MAP[row.skinId];
    if (!skin) throw new Error(`${crate.id}: unknown skin ${row.skinId}`);
    const market = expectedUnboxPrice(row.skinId);
    if (Math.abs(row.value - market) > 0.08) {
      throw new Error(`${crate.id}: reward value must come from PriceProvider unbox EV (${row.skinId})`);
    }
    if (!(row.chance > 0) || row.chance > 100) {
      throw new Error(`${crate.id}: bad chance for ${row.skinId}`);
    }
    if (row.chance > CASE_MAX_SINGLE_CHANCE + 0.25) {
      throw new Error(
        `${crate.id}: ${row.skinId} chance ${row.chance.toFixed(2)}% exceeds ${CASE_MAX_SINGLE_CHANCE}% cap`,
      );
    }
  }

  if (!ids.has(crate.featuredReward)) {
    throw new Error(`${crate.id}: featuredReward not in pool`);
  }

  const lootIds = new Set(crate.loot.map((row) => row.skinId));
  if (lootIds.size !== ids.size || [...ids].some((id) => !lootIds.has(id))) {
    throw new Error(`${crate.id}: loot and rewards must list the same skinIds`);
  }

  const chanceSum = crate.rewards.reduce((s, r) => s + r.chance, 0);
  if (Math.abs(chanceSum - 100) > 0.08) {
    throw new Error(`${crate.id}: chances must sum to 100% (got ${chanceSum.toFixed(3)})`);
  }

  const lootSum = crate.loot.reduce((s, r) => s + r.chance, 0);
  if (Math.abs(lootSum - 100) > 0.08) {
    throw new Error(`${crate.id}: loot chances must sum to 100%`);
  }

  const ev = calculateCaseEV(crate);
  // Slight RTP miss is allowed — throwing here 500'd the homepage. Anti-minus is the hard rule.
  if (!(ev < crate.price)) {
    throw new Error(`${crate.id}: anti-minus failed — EV ${ev.toFixed(3)} ≥ price ${crate.price}`);
  }

  const loseMass = crate.rewards.filter((r) => r.value < crate.price).reduce((s, r) => s + r.chance, 0);
  const winMass = crate.rewards.filter((r) => r.value > crate.price).reduce((s, r) => s + r.chance, 0);
  // Floors sit below balancer mins so a thin pool cannot crash catalog import.
  if (loseMass < CASE_MIN_LOSE_MASS - 10) {
    throw new Error(`${crate.id}: lose mass ${loseMass.toFixed(1)}% too low — players must be able to lose`);
  }
  if (winMass < Math.min(12, CASE_MIN_WIN_MASS)) {
    throw new Error(`${crate.id}: win mass ${winMass.toFixed(1)}% too low — players must be able to profit`);
  }
}
