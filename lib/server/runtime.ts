import type { CaseEconomyStats } from "@/lib/types";

type OpenLog = { caseId: string; price: number; payout: number; at: number };

const g = globalThis as typeof globalThis & {
  __plCaseStats?: Map<string, CaseEconomyStats>;
  __plCaseLog?: OpenLog[];
};

function stats() {
  if (!g.__plCaseStats) g.__plCaseStats = new Map();
  return g.__plCaseStats;
}

function log() {
  if (!g.__plCaseLog) g.__plCaseLog = [];
  return g.__plCaseLog;
}

export function recordCaseOpen(caseId: string, price: number, payout: number) {
  const current = stats().get(caseId) ?? { caseId, opens: 0, revenue: 0, payout: 0 };
  current.opens += 1;
  current.revenue = +(current.revenue + price).toFixed(4);
  current.payout = +(current.payout + payout).toFixed(4);
  stats().set(caseId, current);
  const trail = log();
  trail.push({ caseId, price, payout, at: Date.now() });
  if (trail.length > 50_000) trail.splice(0, trail.length - 40_000);
}

export function getCaseStats(caseId: string): CaseEconomyStats {
  return stats().get(caseId) ?? { caseId, opens: 0, revenue: 0, payout: 0 };
}

export function getAllCaseStats() {
  return Array.from(stats().values());
}
