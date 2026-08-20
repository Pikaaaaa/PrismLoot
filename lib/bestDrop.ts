import { isInVault, vaultStatusLabel } from "@/lib/inventoryOwnership";
import { SKIN_MAP, SKINS } from "@/lib/mock-data";
import { listingWearFor, getSkinPrice } from "@/lib/services/prices";
import type { BestDrop, HistoryEntry, InventoryItem, Skin, UserStats, Wear } from "@/lib/types";
import { WEARS } from "@/lib/wear";

const WEAR_SET = new Set<string>(WEARS);

const SKIN_BY_NAME = new Map(SKINS.map((skin) => [skin.name.trim().toLowerCase(), skin]));

function isWear(value: unknown): value is Wear {
  return typeof value === "string" && WEAR_SET.has(value);
}

export function parseBestDrop(value: unknown): BestDrop | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BestDrop> & { snapshot?: Partial<BestDrop["snapshot"]> };
  if (typeof row.skinId !== "string" || !row.skinId) return null;
  if (!isWear(row.wear)) return null;
  if (!Number.isFinite(row.valueUsd) || (row.valueUsd ?? 0) <= 0) return null;
  if (!Number.isFinite(row.obtainedAt)) return null;
  const snap = row.snapshot;
  if (!snap || typeof snap.name !== "string" || !snap.name) return null;
  if (typeof snap.rarity !== "string" || typeof snap.weapon !== "string") return null;
  const catalog = SKIN_MAP[row.skinId];
  return {
    skinId: row.skinId,
    wear: row.wear,
    instanceId: typeof row.instanceId === "string" ? row.instanceId : undefined,
    snapshot: {
      name: snap.name,
      image: typeof snap.image === "string" ? snap.image : catalog?.image,
      rarity: snap.rarity as BestDrop["snapshot"]["rarity"],
      weapon: snap.weapon as BestDrop["snapshot"]["weapon"],
    },
    valueUsd: row.valueUsd as number,
    obtainedAt: row.obtainedAt as number,
  };
}

export function bestDropFromItem(item: InventoryItem): BestDrop | null {
  const quote = getSkinPrice(item.id, item.wear);
  if (!quote.available || quote.price == null || quote.price <= 0) return null;
  return {
    skinId: item.id,
    wear: item.wear,
    instanceId: item.instanceId,
    snapshot: {
      name: item.name,
      image: item.image,
      rarity: item.rarity,
      weapon: item.weapon,
    },
    valueUsd: quote.price,
    obtainedAt: item.obtainedAt,
  };
}

export function pickHigherBestDrop(current: BestDrop | null, candidate: BestDrop | null): BestDrop | null {
  if (!candidate) return current;
  if (!current || candidate.valueUsd > current.valueUsd) return candidate;
  return current;
}

function namesFromHistory(entry: HistoryEntry): string[] {
  const names: string[] = [];
  if (entry.itemName) names.push(entry.itemName);
  if (entry.targetName) names.push(entry.targetName);
  if (entry.detail) {
    for (const part of entry.detail.split(/\s*→\s*|\s*,\s*/)) {
      const trimmed = part.trim();
      if (trimmed) names.push(trimmed);
    }
  }
  return [...new Set(names)];
}

function bestDropFromHistory(entry: HistoryEntry): BestDrop[] {
  const found: BestDrop[] = [];
  for (const name of namesFromHistory(entry)) {
    const skin = SKIN_BY_NAME.get(name.trim().toLowerCase());
    if (!skin) continue;
    const wear = listingWearFor(skin.id) ?? skin.wear;
    const quote = getSkinPrice(skin.id, wear);
    if (!quote.available || quote.price == null || quote.price <= 0) continue;
    found.push({
      skinId: skin.id,
      wear,
      snapshot: {
        name: skin.name,
        image: skin.image,
        rarity: skin.rarity,
        weapon: skin.weapon,
      },
      valueUsd: quote.price,
      obtainedAt: entry.at,
    });
  }
  return found;
}

export function backfillBestDrop(
  stored: BestDrop | null,
  inventory: InventoryItem[],
  history: HistoryEntry[],
): BestDrop | null {
  let best = stored;
  for (const item of inventory) {
    best = pickHigherBestDrop(best, bestDropFromItem(item));
  }
  for (const entry of history) {
    for (const candidate of bestDropFromHistory(entry)) {
      best = pickHigherBestDrop(best, candidate);
    }
  }
  return best;
}

export function mergeBestDrop(stats: UserStats, items: InventoryItem[]): UserStats {
  let best = stats.bestDrop;
  for (const item of items) {
    best = pickHigherBestDrop(best, bestDropFromItem(item));
  }
  if (best === stats.bestDrop) return stats;
  return {
    ...stats,
    bestDrop: best,
    biggestWin: best ? { name: best.snapshot.name, price: best.valueUsd } : stats.biggestWin,
  };
}

export function hydrateBestDropStats(
  parsed: Partial<UserStats> | undefined,
  inventory: InventoryItem[],
  history: HistoryEntry[],
  base: UserStats,
): UserStats {
  const stored = parseBestDrop(parsed?.bestDrop);
  const already = parsed?.bestDropBackfilled === true;
  const best = already ? stored : backfillBestDrop(stored, inventory, history);
  return {
    ...base,
    ...parsed,
    bestDrop: best,
    bestDropBackfilled: true,
    biggestWin: best ? { name: best.snapshot.name, price: best.valueUsd } : { name: "", price: 0 },
  };
}

export function skinFromBestDrop(drop: BestDrop): Skin {
  const catalog = SKIN_MAP[drop.skinId];
  return {
    id: drop.skinId,
    name: drop.snapshot.name,
    weapon: drop.snapshot.weapon,
    rarity: drop.snapshot.rarity,
    wear: drop.wear,
    image: drop.snapshot.image ?? catalog?.image,
    price: drop.valueUsd,
    stattrak: catalog?.stattrak ?? false,
    colors: catalog?.colors ?? [],
    collection: catalog?.collection,
  };
}

function matchBestDropRow(drop: BestDrop, inventory: InventoryItem[]): InventoryItem | undefined {
  if (drop.instanceId) {
    return inventory.find((item) => item.instanceId === drop.instanceId);
  }
  return inventory.find((item) => item.id === drop.skinId && item.wear === drop.wear && isInVault(item));
}

/** Live vault copy only — sold / used / withdrawn rows stay in inventory for history. */
export function ownedBestDropItem(drop: BestDrop, inventory: InventoryItem[]): InventoryItem | undefined {
  const row = matchBestDropRow(drop, inventory);
  return row && isInVault(row) ? row : undefined;
}

export function bestDropStatusLabel(drop: BestDrop, inventory: InventoryItem[]): string {
  const row = drop.instanceId
    ? inventory.find((item) => item.instanceId === drop.instanceId)
    : matchBestDropRow(drop, inventory);
  if (row && isInVault(row)) return "In vault";
  return (row ? vaultStatusLabel(row) : null) ?? "Sold";
}
