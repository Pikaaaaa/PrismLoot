import { SKIN_MAP } from "@/data/skins";
import { STICKER_MAP, STICKER_SKIN_MAP } from "@/data/stickers";
import type { Skin } from "@/lib/types";

/** Skin catalog + curated Katowice sticker adapters. Cases/contracts stay on SKIN_MAP. */
export function getCatalogItem(id: string): Skin | undefined {
  return SKIN_MAP[id] ?? STICKER_SKIN_MAP[id];
}

export function isStickerItem(item: Pick<Skin, "id" | "weapon"> | string): boolean {
  if (typeof item === "string") return item.startsWith("stk-") || item in STICKER_MAP;
  return item.weapon === "Sticker" || item.id.startsWith("stk-") || item.id in STICKER_MAP;
}
