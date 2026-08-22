import type { HistoryEntry, InventoryItem } from "@/lib/types";
import { isWithdrawPending } from "@/lib/inventoryOwnership";
import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import { isValidMarketPrice } from "@/lib/services/prices/validate";

const HISTORY_KINDS = new Set<HistoryEntry["kind"]>([
  "open",
  "sell",
  "upgrade",
  "contract",
  "battle",
  "deposit",
  "giveaway",
  "withdraw",
]);

/** Accept `/api/me` history payloads without trusting the shape blindly. */
export function parseHistoryEntries(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const rows: HistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<HistoryEntry>;
    if (typeof row.id !== "string" || !row.id) continue;
    if (typeof row.kind !== "string" || !HISTORY_KINDS.has(row.kind as HistoryEntry["kind"])) continue;
    if (typeof row.title !== "string" || typeof row.detail !== "string") continue;
    if (typeof row.amount !== "number" || !Number.isFinite(row.amount)) continue;
    if (typeof row.at !== "number" || !Number.isFinite(row.at)) continue;
    rows.push({
      id: row.id,
      kind: row.kind as HistoryEntry["kind"],
      title: row.title,
      detail: row.detail,
      amount: row.amount,
      at: row.at,
      itemName: typeof row.itemName === "string" ? row.itemName : undefined,
      sourceName: typeof row.sourceName === "string" ? row.sourceName : undefined,
      targetName: typeof row.targetName === "string" ? row.targetName : undefined,
      chance: typeof row.chance === "number" ? row.chance : undefined,
      result:
        row.result === "success" || row.result === "fail" || row.result === "win" || row.result === "loss"
          ? row.result
          : undefined,
    });
  }
  return rows;
}

/** Profile stat: skins sent or queued for Steam — from live inventory, not session history. */
export function withdrawnToSteamSummary(inventory: InventoryItem[]) {
  const rows = inventory.filter((item) => item.leftVia === "withdraw");
  let value = 0;
  for (const item of rows) {
    const quote = getSkinPrice(item.id, item.wear);
    if (quote.available && isValidMarketPrice(quote.price)) value += quote.price;
    else if (item.price > 0) value += item.price;
  }
  return {
    count: rows.length,
    pending: rows.filter(isWithdrawPending).length,
    value: +value.toFixed(2),
  };
}

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
export function memberSinceLabel(
  history: HistoryEntry[],
  inventory: InventoryItem[],
  joinedAt?: number | null,
) {
  if (joinedAt && Number.isFinite(joinedAt) && joinedAt > 0) {
    return MONTH_YEAR.format(new Date(joinedAt));
  }
  const stamps = [...history.map((h) => h.at), ...inventory.map((i) => i.obtainedAt)].filter(
    (at) => Number.isFinite(at) && at > 0,
  );
  if (!stamps.length) return "Today";
  return MONTH_YEAR.format(new Date(Math.min(...stamps)));
}
