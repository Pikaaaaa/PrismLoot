import type { InventoryItem, Rarity, Skin, Wear } from "./types";
import { uid } from "./utils";
import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import { secureUnit } from "@/lib/rewards/rng";
import { UNBOX_WEAR_WEIGHTS, WEARS, wearsForSkin } from "@/lib/wear";

export { WEARS, wearsForSkin };

export function instantiateSkin(
  skin: Skin,
  extras?: Partial<Pick<InventoryItem, "wear" | "stattrak" | "price" | "instanceId" | "obtainedAt" | "stickers">>,
): InventoryItem {
  const allowed = wearsForSkin(skin);
  const wear = extras?.wear && allowed.includes(extras.wear) ? extras.wear : rollWear(skin);
  const resolved = allowed.includes(wear) ? wear : allowed[0] ?? "ft";
  const stattrak = extras?.stattrak ?? skin.stattrak;
  const quote = getSkinPrice(skin.id, resolved);
  const market = extras?.price ?? (quote.available && quote.price != null ? quote.price : null);
  return {
    ...skin,
    wear: resolved,
    stattrak,
    price: market ?? Number.NaN,
    instanceId: extras?.instanceId ?? uid("itm"),
    obtainedAt: extras?.obtainedAt ?? Date.now(),
    ...(extras?.stickers?.length ? { stickers: extras.stickers } : {}),
  };
}

export function rollWear(skinOrRarity?: Skin | Rarity): Wear {
  const allowed = skinOrRarity && typeof skinOrRarity === "object" ? wearsForSkin(skinOrRarity) : WEARS;
  const mass = allowed.map((w) => UNBOX_WEAR_WEIGHTS[w] ?? 0.2);
  const total = mass.reduce((s, n) => s + n, 0) || 1;
  let roll = secureUnit() * total;
  for (let i = 0; i < allowed.length; i++) {
    roll -= mass[i];
    if (roll <= 0) return allowed[i];
  }
  return allowed.includes("ft") ? "ft" : allowed[0] ?? "ft";
}
