"use client";

import { EmptyWellMark } from "@/components/ui/EmptyWellMark";
import { RarityChrome } from "@/components/ui/RarityChrome";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import type { InventoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ContractSlot({
  item,
  index,
  required,
  busy,
  reduceMotion,
  onClear,
}: {
  item: InventoryItem | null;
  index: number;
  required: boolean;
  busy: boolean;
  reduceMotion: boolean;
  onClear: () => void;
}) {
  const label = item
    ? `Remove ${item.name}`
    : required
      ? `Required slot ${index + 1}`
      : `Optional slot ${index + 1}`;

  const shell = cn(
    "relative aspect-square min-w-0 overflow-hidden bg-graphite",
    busy && item && !reduceMotion && "animate-pulse",
  );

  if (!item) {
    return (
      <div className={shell} aria-label={label}>
        <EmptyWellMark compact />
      </div>
    );
  }

  return (
    <button type="button" onClick={onClear} disabled={busy} aria-label={label} className={cn(shell, "text-left")}>
      <SkinVisual
        skin={item}
        framed={false}
        chrome={false}
        showWear={false}
        pad={6}
        className="h-full w-full"
      />
      <RarityChrome rarity={item.rarity} />
    </button>
  );
}
