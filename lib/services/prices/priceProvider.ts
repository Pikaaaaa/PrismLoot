import snapshot from "@/data/price-snapshot.json";
import { PRICE_CACHE_TTL_MS } from "@/lib/economy/config";
import { SKIN_MAP } from "@/data/skins";
import type { PriceDebug, PriceHistory, PriceQuote, SkinPriceRow, Wear } from "@/lib/types";
import { formatConverted } from "./currency";
import { cacheAll, cacheGet, cacheHistory, cacheReset, cacheUpsert, isFresh, rowToQuote } from "./cache";
import { fetchLiveQuote } from "./live";
import { assertValidQuote, isValidMarketPrice } from "./validate";

const SNAPSHOT_AT = snapshot.fetchedAt;
const SNAPSHOT_LABEL = snapshot.sourceName;
type SnapQuote = { skinId: string; wear?: Wear; price: number; currency?: string };

const SNAP_QUOTES = snapshot.quotes as SnapQuote[];

function unavailable(skinId: string, wear?: Wear, reason = "Price unavailable"): PriceQuote {
  return {
    skinId,
    wear,
    available: false,
    price: null,
    currency: "USD",
    source: "unavailable",
    sourceLabel: reason,
    fetchedAt: null,
    expiresAt: null,
    updatedAt: null,
  };
}

/**
 * One-arg PriceProvider lookups (case rows, upgrade targets without an instance wear).
 * Field-Tested is the usual Steam listing staple; FN is not the default.
 */
export function listingWearFor(skinId: string): Wear | undefined {
  const skin = SKIN_MAP[skinId];
  if (!skin) return undefined;
  const allowed = skin.availableWears?.length ? skin.availableWears : (["ft", "mw", "fn", "ww", "bs"] as Wear[]);
  const pref: Wear[] = ["ft", "mw", "ww", "bs", "fn"];
  return pref.find((w) => allowed.includes(w)) ?? allowed[0] ?? skin.wear;
}

function snapshotMatch(skinId: string, wear?: Wear): SnapQuote | undefined {
  if (wear) {
    const exact = SNAP_QUOTES.find((q) => q.skinId === skinId && q.wear === wear);
    if (exact) return exact;
    return undefined;
  }
  const listed = listingWearFor(skinId);
  if (listed) {
    const hit = SNAP_QUOTES.find((q) => q.skinId === skinId && q.wear === listed);
    if (hit) return hit;
  }
  return SNAP_QUOTES.find((q) => q.skinId === skinId && q.wear === "ft")
    ?? SNAP_QUOTES.find((q) => q.skinId === skinId);
}

function snapshotRow(skinId: string, wear?: Wear): SkinPriceRow | null {
  const seeded = snapshotMatch(skinId, wear);
  if (!seeded || !isValidMarketPrice(seeded.price)) return null;
  return {
    skinId,
    wear: seeded.wear,
    price: seeded.price,
    currency: "USD",
    source: "snapshot",
    sourceLabel: SNAPSHOT_LABEL,
    fetchedAt: SNAPSHOT_AT,
    expiresAt: SNAPSHOT_AT + PRICE_CACHE_TTL_MS,
    cachedAt: SNAPSHOT_AT,
    previousPrice: seeded.price,
  };
}

function seedCache() {
  cacheReset();
  for (const q of SNAP_QUOTES) {
    if (!isValidMarketPrice(q.price) || !q.skinId) continue;
    cacheUpsert({
      skinId: q.skinId,
      wear: q.wear,
      price: q.price,
      currency: "USD",
      source: "snapshot",
      sourceLabel: SNAPSHOT_LABEL,
      fetchedAt: SNAPSHOT_AT,
      expiresAt: SNAPSHOT_AT + PRICE_CACHE_TTL_MS,
      cachedAt: Date.now(),
      previousPrice: q.price,
    });
  }
}

seedCache();

function fromRow(row: SkinPriceRow): PriceQuote {
  return assertValidQuote(rowToQuote(row));
}

/**
 * Single price entry for UI and engines.
 * Quotes are per (skinId, wear). Missing wear → Price unavailable — never $0.
 * One-arg calls use the catalog listing wear (upgrade / case rows).
 */
export function getSkinPrice(skinId: string, wear?: Wear): PriceQuote {
  if (!skinId || !SKIN_MAP[skinId]) return unavailable(skinId, wear, "Price unavailable");
  const resolved = wear ?? listingWearFor(skinId);
  if (wear && SKIN_MAP[skinId].availableWears?.length && !SKIN_MAP[skinId].availableWears.includes(wear)) {
    return unavailable(skinId, wear, "Price unavailable");
  }
  const cached = cacheGet(skinId, resolved);
  if (cached && (!resolved || cached.wear === resolved)) return fromRow(cached);
  const seeded = snapshotRow(skinId, resolved);
  if (seeded) {
    cacheUpsert(seeded);
    return fromRow(seeded);
  }
  return unavailable(skinId, resolved, "Price unavailable");
}

export function getSkinPrices(skinIds: string[]): PriceQuote[] {
  return skinIds.map((id) => getSkinPrice(id));
}

export function getPriceHistory(
  skinId: string,
  range: PriceHistory["range"] = "all",
  wear?: Wear,
): PriceHistory {
  const quote = getSkinPrice(skinId, wear);
  const points = cacheHistory(skinId, wear ?? listingWearFor(skinId)).filter((p) => isValidMarketPrice(p.price));
  const windows: Record<Exclude<PriceHistory["range"], "all">, number> = {
    "24H": 24 * 3600_000,
    "7D": 7 * 24 * 3600_000,
    "30D": 30 * 24 * 3600_000,
    "90D": 90 * 24 * 3600_000,
  };
  const cutoff = range === "all" ? 0 : Date.now() - windows[range];
  const sliced = points.filter((p) => p.timestamp >= cutoff);
  const usable = sliced.length ? sliced : points;
  const insufficient = usable.length < 2;
  const first = usable[0];
  const last = usable[usable.length - 1];
  const changePct =
    !insufficient && first && last && first.price > 0 ? +(((last.price - first.price) / first.price) * 100).toFixed(2) : null;
  return {
    skinId,
    points: quote.available ? usable : [],
    changePct,
    range,
    insufficient,
  };
}

export function requireMarketPrice(skinId: string, wear?: Wear): number {
  const quote = getSkinPrice(skinId, wear);
  if (!quote.available || !isValidMarketPrice(quote.price)) {
    throw new Error(`PRICE_UNAVAILABLE:${skinId}${wear ? `:${wear}` : ""}`);
  }
  return quote.price;
}

export function formatQuotePrice(quote: PriceQuote): string {
  if (!quote.available || !isValidMarketPrice(quote.price)) return "Price unavailable";
  return formatConverted(quote.price);
}

export function priceUpdatedLabel(quote: PriceQuote, now = Date.now()) {
  if (!quote.available || quote.updatedAt == null) return "Price temporarily unavailable";
  const mins = Math.max(0, Math.round((now - quote.updatedAt) / 60_000));
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Last updated ${hours}h ago`;
  return `Last updated ${Math.round(hours / 24)}d ago`;
}

export function sellValueUsd(skinId: string, coefficient: number, wear?: Wear): number | null {
  const quote = getSkinPrice(skinId, wear);
  if (!quote.available || !isValidMarketPrice(quote.price)) return null;
  return +(quote.price * coefficient).toFixed(2);
}

export function hydrateQuotes(quotes: PriceQuote[]) {
  for (const quote of quotes) {
    if (!quote.available || !isValidMarketPrice(quote.price) || quote.fetchedAt == null || quote.expiresAt == null) continue;
    cacheUpsert({
      skinId: quote.skinId,
      wear: quote.wear,
      price: quote.price,
      currency: quote.currency,
      source: quote.source === "unavailable" ? "snapshot" : quote.source,
      sourceLabel: quote.sourceLabel,
      fetchedAt: quote.fetchedAt,
      expiresAt: quote.expiresAt,
      cachedAt: Date.now(),
    });
  }
}

export function applyLiveQuote(quote: PriceQuote) {
  if (!quote.available || !isValidMarketPrice(quote.price) || quote.fetchedAt == null || quote.expiresAt == null) {
    throw new Error("INVALID_LIVE_QUOTE");
  }
  return cacheUpsert({
    skinId: quote.skinId,
    wear: quote.wear,
    price: quote.price,
    currency: quote.currency,
    source: "provider",
    sourceLabel: quote.sourceLabel,
    fetchedAt: quote.fetchedAt,
    expiresAt: quote.expiresAt,
    cachedAt: Date.now(),
  });
}

export async function refreshSkinPrice(skinId: string, wear?: Wear): Promise<PriceQuote> {
  const resolved = wear ?? listingWearFor(skinId);
  const cached = cacheGet(skinId, resolved);
  if (cached && isFresh(cached)) return fromRow(cached);
  try {
    const live = await fetchLiveQuote(skinId, resolved);
    applyLiveQuote(live);
    return live;
  } catch {
    if (cached) return fromRow(cached);
    const seeded = snapshotRow(skinId, resolved);
    if (seeded) {
      seeded.expiresAt = Date.now() + PRICE_CACHE_TTL_MS;
      cacheUpsert(seeded);
      return fromRow(seeded);
    }
    return unavailable(skinId, resolved, "Price temporarily unavailable");
  }
}

export function debugPrice(skinId: string, wear?: Wear): PriceDebug {
  const quote = getSkinPrice(skinId, wear);
  const row = cacheGet(skinId, wear ?? listingWearFor(skinId));
  const history = getPriceHistory(skinId, "24H", wear);
  return {
    skinId,
    name: SKIN_MAP[skinId]?.name,
    marketPrice: quote.price,
    previousPrice: row?.previousPrice ?? quote.price,
    change24h: history.insufficient ? null : history.changePct,
    source: quote.source,
    sourceLabel: quote.sourceLabel,
    fetchedAt: quote.fetchedAt,
    cachedAt: row?.cachedAt ?? null,
    expiresAt: quote.expiresAt,
    currency: quote.currency,
    available: quote.available,
  };
}

export function listPriceTable(): PriceDebug[] {
  return cacheAll().map((row) => debugPrice(row.skinId, row.wear));
}

export { snapshot as PRICE_SNAPSHOT };
export { fetchLiveQuote };
