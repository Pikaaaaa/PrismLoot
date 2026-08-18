import { SKIN_MAP } from "@/data/skins";
import { PRICE_CACHE_TTL_MS } from "@/lib/economy/config";
import type { PriceQuote } from "@/lib/types";
import { WEAR_META } from "@/lib/rarity";
import { isValidMarketPrice } from "./validate";

function parseSteamUsd(raw?: string) {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return isValidMarketPrice(n) ? +n.toFixed(2) : null;
}

export function steamMarketHashName(skinId: string, wear?: import("@/lib/types").Wear) {
  const skin = SKIN_MAP[skinId];
  if (!skin) return null;
  const exterior = WEAR_META[wear ?? skin.wear ?? "ft"].label;
  const named = `${skin.name} (${exterior})`;
  return skin.stattrak ? `StatTrak™ ${named}` : named;
}

/**
 * Optional live hook. UI never calls this — only PriceProvider sync on the server.
 * Steam Community Market is a public endpoint; images live on Steam CDN and are NOT prices.
 */
export async function fetchLiveQuote(skinId: string, wear?: import("@/lib/types").Wear): Promise<PriceQuote> {
  if (typeof window !== "undefined") {
    throw new Error("LIVE_PRICE_CLIENT_FORBIDDEN");
  }
  const hash = steamMarketHashName(skinId);
  if (!hash) throw new Error("UNKNOWN_SKIN");
  const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(hash)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ac.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("LIVE_UNAVAILABLE");
    const data = (await res.json()) as { success?: boolean; median_price?: string; lowest_price?: string };
    const price = parseSteamUsd(data.median_price) ?? parseSteamUsd(data.lowest_price);
    if (!data.success || !isValidMarketPrice(price)) throw new Error("LIVE_UNAVAILABLE");
    const now = Date.now();
    return {
      skinId,
      wear,
      available: true,
      price,
      currency: "USD",
      source: "provider",
      sourceLabel: "Steam Community Market",
      fetchedAt: now,
      expiresAt: now + PRICE_CACHE_TTL_MS,
      updatedAt: now,
    };
  } finally {
    clearTimeout(t);
  }
}
