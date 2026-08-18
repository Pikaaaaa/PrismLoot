import { instantiateSkin } from "@/lib/game";
import { SKIN_MAP } from "@/data/skins";
import { secureId } from "@/lib/rewards/rng";
import type { InventoryItem, Wear } from "@/lib/types";

/** Catalog lookup only. Never trust client-sent price or rarity. */
export function createInventoryItem(skinId: string, extras?: { wear?: Wear; stattrak?: boolean }): InventoryItem {
  const skin = SKIN_MAP[skinId];
  if (!skin) throw new Error(`Unknown skin ${skinId}`);
  return instantiateSkin(skin, {
    wear: extras?.wear,
    stattrak: extras?.stattrak ?? false,
    instanceId: secureId("itm"),
    obtainedAt: Date.now(),
  });
}
