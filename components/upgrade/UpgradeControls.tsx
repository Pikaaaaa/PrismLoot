"use client";

import { FilterChip, FilterRow } from "@/components/ui/FilterBar";
import { Shuffle } from "lucide-react";

export const UPGRADE_MULTS = [2, 5, 10, 20] as const;
export const UPGRADE_CHANCE_CHIPS = [3, 5, 30] as const;

export function UpgradeControls({
  disabled,
  intentMult,
  intentChance,
  illegalMult,
  illegalChance,
  onMult,
  onChance,
  onShuffle,
}: {
  disabled: boolean;
  intentMult: number | null;
  intentChance: number | null;
  illegalMult?: (m: number) => boolean;
  illegalChance?: (n: number) => boolean;
  onMult: (m: number) => void;
  onChance: (n: number) => void;
  onShuffle: () => void;
}) {
  return (
    <FilterRow>
      {UPGRADE_MULTS.map((m) => (
        <FilterChip
          key={`x${m}`}
          active={intentMult === m}
          disabled={disabled || !!illegalMult?.(m)}
          onClick={() => onMult(m)}
        >
          x{m}
        </FilterChip>
      ))}
      {UPGRADE_CHANCE_CHIPS.map((n) => (
        <FilterChip
          key={`${n}pct`}
          active={intentChance === n}
          disabled={disabled || !!illegalChance?.(n)}
          onClick={() => onChance(n)}
        >
          {n}%
        </FilterChip>
      ))}
      <FilterChip disabled={disabled} onClick={onShuffle} title="Random target" aria-label="Random target">
        <Shuffle className="h-3.5 w-3.5" />
      </FilterChip>
    </FilterRow>
  );
}
