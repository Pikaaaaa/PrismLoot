import { RarityToken } from "@/components/ui/RarityToken";
import type { Rarity } from "@/lib/types";

export function RarityBadge({ rarity, compact }: { rarity: Rarity; compact?: boolean }) {
  return <RarityToken rarity={rarity} label={!compact} />;
}
