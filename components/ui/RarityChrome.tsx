import { RARITY_META, isHighRarity } from "@/lib/rarity";
import type { Rarity } from "@/lib/types";

/** Quiet CS2 grade cue: one hairline. No neon L, no wash overlay. */
export function RarityChrome({
  rarity,
  edge = "bottom",
  inset = false,
}: {
  rarity: Rarity;
  edge?: "bottom" | "left";
  /** Keep the hairline off rounded corners so it doesn’t clip crooked. */
  inset?: boolean;
}) {
  const meta = RARITY_META[rarity];
  const strong = isHighRarity(rarity);
  return edge === "bottom" ? (
    <span
      aria-hidden
      className={
        inset
          ? "pointer-events-none absolute bottom-1.5 left-2 right-2 z-[6] h-px rounded-full"
          : "pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-px"
      }
      style={{ background: meta.color, opacity: strong ? 0.85 : 0.55 }}
    />
  ) : (
    <span
      aria-hidden
      className={
        inset
          ? "pointer-events-none absolute bottom-2 top-2 left-1.5 z-[6] w-px rounded-full"
          : "pointer-events-none absolute inset-y-0 left-0 z-[6] w-px"
      }
      style={{ background: meta.color, opacity: strong ? 0.85 : 0.55 }}
    />
  );
}
