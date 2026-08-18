import type { PriceQuote, SkinPriceRow } from "@/lib/types";
import type { Wear } from "@/lib/types";

const rows = new Map<string, SkinPriceRow>();
const history = new Map<string, Array<{ timestamp: number; price: number }>>();

export function priceCacheKey(skinId: string, wear?: Wear | null) {
  return wear ? `${skinId}::${wear}` : skinId;
}

export function cacheGet(skinId: string, wear?: Wear | null): SkinPriceRow | undefined {
  if (wear) return rows.get(priceCacheKey(skinId, wear));
  return rows.get(skinId);
}

export function cacheAll(): SkinPriceRow[] {
  return [...rows.values()].sort((a, b) => {
    const id = a.skinId.localeCompare(b.skinId);
    if (id !== 0) return id;
    return (a.wear ?? "").localeCompare(b.wear ?? "");
  });
}

export function cacheReset() {
  rows.clear();
  history.clear();
}

export function cacheUpsert(row: SkinPriceRow) {
  const key = priceCacheKey(row.skinId, row.wear);
  const prev = rows.get(key);
  const previousPrice = prev && prev.price !== row.price ? prev.price : (prev?.previousPrice ?? row.previousPrice);
  const next: SkinPriceRow = { ...row, previousPrice };
  rows.set(key, next);
  if (row.wear) rows.delete(row.skinId);
  else rows.set(row.skinId, next);

  const points = history.get(key) ?? [];
  const last = points[points.length - 1];
  if (!last || last.price !== row.price || last.timestamp !== row.fetchedAt) {
    points.push({ timestamp: row.fetchedAt, price: row.price });
  }
  history.set(key, points);
  return next;
}

export function cacheHistory(skinId: string, wear?: Wear | null) {
  return history.get(priceCacheKey(skinId, wear)) ?? history.get(skinId) ?? [];
}

export function rowToQuote(row: SkinPriceRow, now = Date.now()): PriceQuote {
  return {
    skinId: row.skinId,
    wear: row.wear,
    available: true,
    price: row.price,
    currency: row.currency,
    source: now <= row.expiresAt ? "cache" : row.source,
    sourceLabel: row.sourceLabel,
    fetchedAt: row.fetchedAt,
    expiresAt: row.expiresAt,
    updatedAt: row.fetchedAt,
  };
}

export function isFresh(row: SkinPriceRow, now = Date.now()) {
  return now <= row.expiresAt;
}
