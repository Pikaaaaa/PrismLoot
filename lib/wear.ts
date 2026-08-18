import { SKIN_MAP } from "@/data/skins";
import { getSkinPrice, listingWearFor, requireMarketPrice } from "@/lib/services/prices/priceProvider";
import type { Skin, Wear } from "@/lib/types";

export const WEARS: Wear[] = ["fn", "mw", "ft", "ww", "bs"];

/** Same mix `rollWear` uses — EV must price this lottery, not listing FT alone. */
export const UNBOX_WEAR_WEIGHTS: Record<Wear, number> = { fn: 0.12, mw: 0.3, ft: 0.38, ww: 0.12, bs: 0.08 };

export function wearsForSkin(skin: Pick<Skin, "availableWears" | "wear">): Wear[] {
  if (skin.availableWears?.length) return skin.availableWears;
  return WEARS;
}

/**
 * Expected market payout if wear is rolled on unbox.
 * Case RTP/anti-minus uses this, not FN max and not listing-wear-only.
 */
export function expectedUnboxPrice(skinId: string): number {
  const skin = SKIN_MAP[skinId];
  if (!skin) throw new Error(`Missing catalog skin ${skinId}`);
  const allowed = wearsForSkin(skin);
  let massSum = 0;
  let payout = 0;
  for (const wear of allowed) {
    const quote = getSkinPrice(skinId, wear);
    if (!quote.available || quote.price == null || !(quote.price > 0)) continue;
    const mass = UNBOX_WEAR_WEIGHTS[wear] ?? 0.2;
    massSum += mass;
    payout += mass * quote.price;
  }
  if (massSum > 0) return payout / massSum;
  const listed = listingWearFor(skinId);
  return listed ? requireMarketPrice(skinId, listed) : requireMarketPrice(skinId);
}
