import type { CaseReward, Crate } from "@/lib/types";
import { expectedUnboxPrice } from "@/lib/wear";

export function calculateCaseEV(crate: Pick<Crate, "rewards"> | CaseReward[]): number {
  const rewards = Array.isArray(crate) ? crate : crate.rewards;
  return rewards.reduce((sum, row) => {
    let value = row.value;
    try {
      value = expectedUnboxPrice(row.skinId);
    } catch {
      value = row.value;
    }
    return sum + (row.chance / 100) * value;
  }, 0);
}

export function actualRtp(revenue: number, payout: number) {
  if (revenue <= 0) return 0;
  return payout / revenue;
}

/** Catalog RTP as paid EV / price. Must stay < 1 (anti-minus). */
export function catalogRtp(crate: Pick<Crate, "price" | "rewards">): number {
  if (!(crate.price > 0)) return 0;
  return calculateCaseEV(crate) / crate.price;
}
