import type { HistoryEntry, InventoryItem } from "@/lib/types";

export type ActivitySummary = {
  upgradesWon: number;
  upgradesLost: number;
  contracts: number;
  /** Everything the account has staked, in USD. */
  wagered: number;
  /** Best realised upgrade multiplier, derived from the confirmed chance. */
  bestMultiplier: number | null;
};

export function deriveActivity(history: HistoryEntry[]): ActivitySummary {
  let upgradesWon = 0;
  let upgradesLost = 0;
  let contracts = 0;
  let wagered = 0;
  let bestMultiplier: number | null = null;

  for (const entry of history) {
    if (entry.amount < 0) wagered += -entry.amount;
    if (entry.kind === "contract") contracts += 1;
    if (entry.kind !== "upgrade") continue;
    const won = entry.result ? entry.result === "success" : entry.amount > 0;
    if (won) {
      upgradesWon += 1;
      if (entry.chance != null && entry.chance > 0) {
        const multiplier = 100 / entry.chance;
        if (bestMultiplier == null || multiplier > bestMultiplier) bestMultiplier = multiplier;
      }
    } else {
      upgradesLost += 1;
    }
  }

  return { upgradesWon, upgradesLost, contracts, wagered: +wagered.toFixed(2), bestMultiplier };
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Oldest trace of the account. UTC-pinned so the server and the client render
 * the same string.
 */
export function memberSinceLabel(history: HistoryEntry[], inventory: InventoryItem[]) {
  const stamps = [...history.map((h) => h.at), ...inventory.map((i) => i.obtainedAt)].filter(
    (at) => Number.isFinite(at) && at > 0,
  );
  if (!stamps.length) return "Today";
  return MONTH_YEAR.format(new Date(Math.min(...stamps)));
}
