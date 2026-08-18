"use client";

import { BATTLE_MODE_LABEL, BattleCard } from "@/components/battle/BattleCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip, FilterRow } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/lib/store";
import type { BattleMode } from "@/lib/types";
import { Swords } from "lucide-react";
import { useMemo, useState } from "react";

const MODES: Array<BattleMode | "all"> = ["all", "1v1", "2v2", "3v3", "ffa"];

export default function BattlesPage() {
  const { battles } = useAppStore();
  const [mode, setMode] = useState<(typeof MODES)[number]>("all");
  const list = useMemo(
    () => battles.filter((battle) => (mode === "all" ? true : battle.mode === mode)),
    [battles, mode],
  );

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Arena"
        title="Battles"
        description="Same crates, same sequence. Highest combined pull takes the pot."
      />

      <div className="section-stack">
        <FilterRow>
          {MODES.map((chip) => (
            <FilterChip
              key={chip}
              active={mode === chip}
              onClick={() => setMode(chip)}
              className="uppercase tracking-wider"
            >
              {BATTLE_MODE_LABEL[chip]}
            </FilterChip>
          ))}
        </FilterRow>

        {list.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((battle) => (
              <BattleCard key={battle.id} battle={battle} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Swords />}
            title={mode === "all" ? "No battles queued" : "No battles in this mode"}
            detail={
              mode === "all"
                ? "The arena is empty right now."
                : "Nothing is queued for that format — try another mode."
            }
            action={
              mode === "all" ? null : (
                <Button size="sm" variant="ghost" onClick={() => setMode("all")}>
                  Show all battles
                </Button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}
