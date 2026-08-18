"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/EmptyState";
import { Price } from "@/components/ui/Price";
import { RarityChrome } from "@/components/ui/RarityChrome";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import type { ContractPreview } from "@/lib/engine/contract";
import { RARITY_META, WEAR_META } from "@/lib/rarity";
import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import type { InventoryItem, Skin } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { useEffect, useState } from "react";

export type ContractPhase = "idle" | "forging" | "reveal" | "error";

export function ContractResult({
  phase,
  preview,
  reward,
  profit,
  error,
  reduceMotion,
  onRetry,
  onDismiss,
}: {
  phase: ContractPhase;
  preview: ContractPreview | null;
  reward: InventoryItem | null;
  profit: number;
  error: string | null;
  reduceMotion: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const pool = preview?.rewards ?? [];
  const [frame, setFrame] = useState(0);
  const cycling = pool[frame % Math.max(pool.length, 1)]?.skin ?? null;

  useEffect(() => {
    if (phase !== "forging" || reduceMotion || pool.length < 2) return;
    const id = window.setInterval(() => setFrame((n) => n + 1), 110);
    return () => window.clearInterval(id);
  }, [phase, reduceMotion, pool.length]);

  if (phase === "error") {
    return (
      <ErrorState
        title="Contract failed"
        detail={error ?? "The contract could not be resolved."}
        action={
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  if (phase === "forging") {
    return <ForgeWell skin={reduceMotion ? null : cycling} reduceMotion={reduceMotion} />;
  }

  if (phase === "reveal" && reward) {
    return <RevealCard skin={reward} profit={profit} onDismiss={onDismiss} />;
  }

  return null;
}

function ForgeWell({ skin, reduceMotion }: { skin: Skin | null; reduceMotion: boolean }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3">
      <div className="relative w-full overflow-hidden rounded-[var(--radius-md)] bg-graphite">
        <div className="relative aspect-[4/3] w-full">
          {!reduceMotion ? (
            <span
              aria-hidden
              className="absolute inset-[16%] animate-spin rounded-full border-2 border-cyan/20"
              style={{ borderTopColor: "var(--color-cyan)", animationDuration: "1.4s" }}
            />
          ) : null}
          {skin ? (
            <SkinVisual
              skin={skin}
              framed={false}
              chrome={false}
              showWear={false}
              pad={16}
              className="h-full w-full"
            />
          ) : null}
        </div>
      </div>
      <p className="label text-cyan">{reduceMotion ? "Resolving" : "Signing"}</p>
    </div>
  );
}

function RevealCard({
  skin,
  profit,
  onDismiss,
}: {
  skin: InventoryItem;
  profit: number;
  onDismiss: () => void;
}) {
  const rarity = RARITY_META[skin.rarity];
  const gained = profit >= 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative overflow-hidden rounded-[var(--radius-md)] bg-graphite">
        <SkinVisual
          skin={skin}
          framed={false}
          chrome={false}
          showWear={false}
          pad={16}
          className="h-44 w-full"
        />
        <RarityChrome rarity={skin.rarity} />
      </div>
      <div className="min-w-0">
        <Badge tone={gained ? "accent" : "danger"}>{gained ? "Profit" : "Loss"}</Badge>
        <h3 className="mt-2 truncate" title={skin.name}>
          {skin.name}
        </h3>
        <p className="meta mt-1">
          {WEAR_META[skin.wear].label}
          <span className="mx-1.5 text-mute">·</span>
          <span style={{ color: rarity.color }}>{rarity.label}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Price quote={getSkinPrice(skin.id, skin.wear)} />
          <p className={cn("tabular text-sm font-semibold", gained ? "text-cyan" : "text-danger")}>
            {gained ? "+" : "−"}
            {formatMoney(Math.abs(profit))}
          </p>
        </div>
      </div>
      <Button fullWidth onClick={onDismiss}>
        Keep in inventory
      </Button>
    </div>
  );
}
