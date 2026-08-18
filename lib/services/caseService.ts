import { CASES, getCase } from "@/data/cases";
import { calculateCaseEV } from "@/lib/economy";
import { rollCase } from "@/lib/rewards/rewardEngine";
import { recordCaseOpen } from "@/lib/server/runtime";
import type { RolledCaseReward } from "@/lib/types";
import { caseOpenHistory } from "./historyService";

export function listCases() {
  return CASES;
}

export function openCase(caseId: string): {
  roll: RolledCaseReward;
  history: ReturnType<typeof caseOpenHistory>;
  theoreticalEV: number;
} {
  const crate = getCase(caseId);
  if (!crate) {
    const err = new Error("CASE_NOT_FOUND");
    err.name = "CASE_NOT_FOUND";
    throw err;
  }
  const roll = rollCase(crate.id);
  recordCaseOpen(crate.id, crate.price, roll.value);
  return {
    roll,
    theoreticalEV: calculateCaseEV(crate),
    history: caseOpenHistory({
      caseName: crate.name,
      skinName: roll.item.name,
      price: crate.price,
      payout: roll.value,
    }),
  };
}

export function openCases(caseId: string, count = 1) {
  const n = Math.min(5, Math.max(1, Math.floor(count) || 1));
  const crate = getCase(caseId);
  if (!crate) {
    const err = new Error("CASE_NOT_FOUND");
    err.name = "CASE_NOT_FOUND";
    throw err;
  }
  const rolls = [];
  for (let i = 0; i < n; i++) {
    rolls.push(openCase(caseId));
  }
  return {
    items: rolls.map((row) => row.roll.item),
    charged: +(crate.price * n).toFixed(2),
    rolls: rolls.map((row) => ({
      chance: row.roll.chance,
      theoreticalEV: row.theoreticalEV,
      item: row.roll.item,
      history: row.history,
    })),
  };
}

export function simulateCase(caseId: string, n: number) {
  const crate = getCase(caseId);
  if (!crate) throw new Error("CASE_NOT_FOUND");
  const count = Math.min(Math.max(Math.floor(n), 1), 100_000);
  let payout = 0;
  const dist = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const roll = rollCase(crate.id);
    payout += roll.value;
    dist.set(roll.skinId, (dist.get(roll.skinId) ?? 0) + 1);
  }
  const revenue = crate.price * count;
  const ev = calculateCaseEV(crate);
  const theoreticalRtp = crate.rtp;
  const simulatedRtp = revenue > 0 ? payout / revenue : 0;
  const meanPayout = payout / count;
  const varianceHint = Math.abs(simulatedRtp - theoreticalRtp) > 0.025 && count < 50_000;
  return {
    caseId: crate.id,
    n: count,
    revenue,
    payout,
    profit: revenue - payout,
    theoreticalEV: ev,
    theoreticalRtp,
    simulatedRtp,
    meanPayout,
    houseEdge: crate.houseEdge,
    highVariance: varianceHint,
    message: varianceHint ? "High variance — increase sample size" : undefined,
    distribution: [...dist.entries()].map(([skinId, hits]) => ({
      skinId,
      hits,
      share: hits / count,
    })),
  };
}
