"use client";

import { SkinCard } from "@/components/skin/SkinCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip, FilterRow, SelectField } from "@/components/ui/FilterBar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RARITY_DESC, RARITY_META } from "@/lib/rarity";
import type { Rarity, Skin } from "@/lib/types";
import { useMemo, useState } from "react";

export type RewardRow = {
  skinId: string;
  chance: number;
  rarity: Rarity;
  skin: Skin;
  price: number | null;
};

type SortId = "chance" | "price";

export function CaseRewardGrid({ loot }: { loot: RewardRow[] }) {
  const [sort, setSort] = useState<SortId>("chance");
  const [rarity, setRarity] = useState<Rarity | "all">("all");

  const present = useMemo(
    () => RARITY_DESC.filter((grade) => loot.some((row) => row.rarity === grade)),
    [loot],
  );

  const visible = useMemo(() => {
    const filtered = rarity === "all" ? loot : loot.filter((row) => row.rarity === rarity);
    return filtered.slice().sort((a, b) => {
      if (sort === "price") return (b.price ?? 0) - (a.price ?? 0);
      return a.chance - b.chance;
    });
  }, [loot, rarity, sort]);

  return (
    <section className="section-stack">
      <SectionHeading
        title="Possible rewards"
        count={loot.length}
        description="Every drop in this crate. Wear is rolled when you open."
        actions={
          <SelectField
            value={sort}
            onChange={(event) => setSort(event.target.value as SortId)}
            aria-label="Sort rewards"
          >
            <option value="chance">By chance</option>
            <option value="price">By price</option>
          </SelectField>
        }
      />

      {present.length > 1 ? (
        <FilterRow>
          <FilterChip active={rarity === "all"} onClick={() => setRarity("all")}>
            All
          </FilterChip>
          {present.map((grade) => (
            <FilterChip key={grade} active={rarity === grade} onClick={() => setRarity(grade)}>
              {RARITY_META[grade].label}
            </FilterChip>
          ))}
        </FilterRow>
      ) : null}

      {visible.length ? (
        <div className="skin-grid">
          {visible.map((row) => (
            <SkinCard key={row.skinId} skin={row.skin} chance={row.chance} showWear={false} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No rewards match"
          detail="That rarity is not in this crate."
          action={
            <Button size="sm" variant="ghost" onClick={() => setRarity("all")}>
              Show all
            </Button>
          }
        />
      )}
    </section>
  );
}
