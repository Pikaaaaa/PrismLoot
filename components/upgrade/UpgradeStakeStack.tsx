"use client";

import { EmptyWellMark } from "@/components/ui/EmptyWellMark";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import type { InventoryItem } from "@/lib/types";
import { formatBalance, formatMoney } from "@/lib/utils";
import { X } from "lucide-react";

function Thumb({
  item,
  onRemove,
  className,
  pad = 4,
}: {
  item: InventoryItem;
  onRemove?: (item: InventoryItem) => void;
  className?: string;
  pad?: number;
}) {
  const visual = (
    <SkinVisual
      skin={item}
      framed={false}
      chrome={false}
      showWear={false}
      pad={pad}
      className="h-full w-full"
    />
  );
  if (!onRemove) {
    return <div className={className}>{visual}</div>;
  }
  return (
    <button
      type="button"
      title={`Remove ${item.name}`}
      onClick={() => onRemove(item)}
      className={className}
    >
      {visual}
      <span className="absolute inset-0 grid place-items-center bg-void/0 text-ink opacity-0 transition-opacity hover:bg-void/55 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

/** Rectangular thumbs only — never circular crops or rotated overlapping fans. */
function StakeItems({
  items,
  onRemove,
}: {
  items: InventoryItem[];
  onRemove?: (item: InventoryItem) => void;
}) {
  if (items.length === 1) {
    return (
      <Thumb
        item={items[0]}
        onRemove={onRemove}
        pad={10}
        className="relative h-full w-full overflow-hidden"
      />
    );
  }

  const shown = items.slice(0, 6);

  return (
    <div className="flex h-full w-full items-center justify-center gap-1.5 px-2.5">
      {shown.map((item) => (
        <Thumb
          key={item.instanceId}
          item={item}
          onRemove={onRemove}
          className="relative h-[70%] min-w-0 max-w-[3.75rem] flex-1 overflow-hidden rounded-[var(--radius-sm)] border border-line bg-graphite"
        />
      ))}
      {items.length > 1 ? (
        <span className="pointer-events-none shrink-0 rounded-full border border-line bg-void/85 px-1.5 py-px font-display text-[length:var(--type-micro)] font-bold tabular">
          {items.length > shown.length ? `+${items.length}` : items.length}
        </span>
      ) : null}
    </div>
  );
}

export function UpgradeStakeStack({
  items,
  max,
  extra,
  maxExtra,
  onRemove,
  onExtra,
  locked,
}: {
  items: InventoryItem[];
  max: number;
  extra: number;
  maxExtra: number;
  onRemove: (item: InventoryItem) => void;
  onExtra: (n: number) => void;
  locked?: boolean;
}) {
  const skinsValue = items.reduce((sum, item) => sum + (getSkinPrice(item.id, item.wear).price ?? 0), 0);
  const sliderMax = items.length && maxExtra > 0 ? maxExtra : 0;
  const sliderValue = Math.min(extra, sliderMax);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="label">Select up to {max} items to upgrade</p>
      <div className="upgrade-well w-full">
        {items.length === 0 ? (
          <EmptyWellMark />
        ) : (
          <StakeItems items={items} onRemove={locked ? undefined : onRemove} />
        )}
      </div>
      {items.length ? (
        <p className="meta tabular">
          {items.length}/{max}
          {` · ${formatMoney(skinsValue)}`}
          {extra > 0 ? ` + ${formatBalance(extra)}` : ""}
        </p>
      ) : null}
      <label className="flex min-w-0 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="label">Add balance</span>
          <span className="tabular text-[length:var(--type-micro)] font-semibold text-ink">
            {formatBalance(sliderValue)}
            <span className="meta"> (max {formatBalance(sliderMax)})</span>
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={0.01}
          value={sliderValue}
          disabled={locked || sliderMax <= 0}
          aria-label="Extra stake from balance"
          onChange={(e) => onExtra(Number(e.target.value))}
          className="h-1.5 w-full accent-cyan"
        />
      </label>
    </div>
  );
}
