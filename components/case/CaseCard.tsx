"use client";

import { Button } from "@/components/ui/Button";
import { CaseVisual } from "@/components/visuals/CaseVisual";
import { RARITY_DESC, RARITY_META } from "@/lib/rarity";
import { useAppStore } from "@/lib/store";
import type { Crate, Rarity } from "@/lib/types";
import { uniqueCrates } from "@/lib/ui/catalog";
import { cn, formatMoney } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

const MAX_RARITY_DOTS = 6;

/** Distinct grades inside the crate, best first, capped so the row never wraps. */
function crateRarities(crate: Crate): Rarity[] {
  const present = new Set(crate.rewards.map((reward) => reward.rarity));
  return RARITY_DESC.filter((rarity) => present.has(rarity)).slice(0, MAX_RARITY_DOTS);
}

function RarityDots({ rarities }: { rarities: Rarity[] }) {
  if (!rarities.length) return null;
  return (
    <span
      role="img"
      className="flex shrink-0 items-center gap-1"
      aria-label={`Contains ${rarities.map((rarity) => RARITY_META[rarity].label).join(", ")}`}
    >
      {rarities.map((rarity) => (
        <span
          key={rarity}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: RARITY_META[rarity].color }}
        />
      ))}
    </span>
  );
}

export function CaseCard({ crate, compact }: { crate: Crate; compact?: boolean }) {
  const { priceTick, displayCurrency } = useAppStore();
  void priceTick;
  void displayCurrency;

  const rarities = useMemo(() => crateRarities(crate), [crate]);
  const top = RARITY_META[rarities[0] ?? "common"];

  return (
    <article className="group surface card-hover relative flex h-full min-w-0 flex-col overflow-hidden">
      <div
        className="relative aspect-[5/4] w-full overflow-hidden bg-graphite"
        style={{ boxShadow: `inset 0 -1px 0 ${top.color}59` }}
      >
        <CaseVisual crate={crate} size="card" className="h-full w-full" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-[var(--dur)] ease-[var(--ease)] group-hover:opacity-100"
          style={{ background: `radial-gradient(62% 58% at 50% 62%, ${top.color}24, transparent 72%)` }}
        />
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col", compact ? "p-2.5" : "p-3")}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 truncate">{crate.name}</h3>
          <span className="price shrink-0">{formatMoney(crate.price)}</span>
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2">
          <RarityDots rarities={rarities} />
          <span className="meta tabular ml-auto truncate">{crate.rewards.length} items</span>
        </div>

        <div className={cn("mt-auto", compact ? "pt-2.5" : "pt-3")}>
          <Button
            variant="ghost"
            size={compact ? "xs" : "sm"}
            fullWidth
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none group-hover:border-cyan group-hover:bg-cyan group-hover:text-void"
          >
            Open
          </Button>
        </div>
      </div>

      <Link
        href={`/cases/${crate.id}`}
        aria-label={`Open ${crate.name}`}
        className="absolute inset-0 z-[2] rounded-[var(--radius-lg)]"
      />
    </article>
  );
}

export function CaseGrid({ crates, compact }: { crates: Crate[]; compact?: boolean }) {
  const unique = uniqueCrates(crates);
  return (
    <div className="case-grid">
      {unique.map((crate) => (
        <CaseCard key={crate.id} crate={crate} compact={compact} />
      ))}
    </div>
  );
}
