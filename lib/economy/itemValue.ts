import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import type { AppliedSticker, Wear } from "@/lib/types";
import { valueWithStickers } from "./stickerValue";

/**
 * Inventory/craft market USD: PriceProvider base + optional applied-sticker overlay.
 * Stickers never replace the skin quote.
 */
export function marketValueUsd(
  skinId: string,
  wear?: Wear,
  stickers?: AppliedSticker[] | null,
  fallbackPrice?: number,
): number | null {
  const quote = getSkinPrice(skinId, wear);
  const base =
    quote.available && quote.price != null
      ? quote.price
      : fallbackPrice != null && fallbackPrice > 0
        ? fallbackPrice
        : null;
  if (base == null || !(base > 0) || !Number.isFinite(base)) return null;
  return valueWithStickers(base, stickers);
}
