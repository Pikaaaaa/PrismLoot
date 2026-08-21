import { STICKER_MAP } from "@/data/stickers";
import type { AppliedSticker } from "@/lib/types";

/**
 * Applied stickers rarely add 100% of unapplied face value on the CS market.
 * Typical craft contribution for expensive Katowice holos sits roughly in the
 * 10–20% band (position/craft/wear dependent). We use a conservative 15%.
 */
export const APPLIED_STICKER_FACTOR = 0.15;

/** Extra haircut as scrape wear → 1 (fully scraped ≈ negligible). */
function wearFactor(wear = 0): number {
  const w = Math.min(1, Math.max(0, wear));
  return 1 - w * 0.92;
}

/** Unapplied face value for a catalog sticker id, or null if unknown. */
export function stickerFaceValue(stickerId: string): number | null {
  const row = STICKER_MAP[stickerId];
  if (!row || !(row.price > 0)) return null;
  return row.price;
}

/**
 * USD contribution of one applied sticker toward a skin's craft value.
 * Does not mutate PriceProvider skin quotes — additive overlay only.
 */
export function appliedStickerContribution(applied: AppliedSticker): number {
  const face = stickerFaceValue(applied.stickerId);
  if (face == null) return 0;
  return +(face * APPLIED_STICKER_FACTOR * wearFactor(applied.wear)).toFixed(2);
}

/** Sum of applied sticker contributions (capped slots ignored — caller supplies list). */
export function stickersContribution(applied: AppliedSticker[] | undefined | null): number {
  if (!applied?.length) return 0;
  return +applied.reduce((sum, row) => sum + appliedStickerContribution(row), 0).toFixed(2);
}

/**
 * Skin/inventory market quote + conservative applied-sticker overlay.
 * Pass the PriceProvider quote (or any base USD) — stickers never replace it.
 */
export function valueWithStickers(baseMarketUsd: number, applied?: AppliedSticker[] | null): number {
  if (!(baseMarketUsd > 0) || !Number.isFinite(baseMarketUsd)) return baseMarketUsd;
  return +(baseMarketUsd + stickersContribution(applied)).toFixed(2);
}
