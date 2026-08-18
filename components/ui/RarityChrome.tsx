import { RARITY_META, isHighRarity } from "@/lib/rarity";
import type { Rarity } from "@/lib/types";

/** Quiet CS2 grade cue: one hairline. No neon L, no wash overlay. */
export function RarityChrome({
  rarity,
  edge = "bottom",
}: {
  rarity: Rarity;
  edge?: "bottom" | "left";
}) {
  const meta = RARITY_META[rarity];
  const strong = isHighRarity(rarity);
  return edge === "bottom" ? (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-px"
      style={{ background: meta.color, opacity: strong ? 0.85 : 0.55 }}
    />
  ) : (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 z-[6] w-px"
      style={{ background: meta.color, opacity: strong ? 0.85 : 0.55 }}
    />
  );
}
