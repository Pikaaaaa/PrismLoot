"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight, Handshake, Info, Send, Wallet } from "lucide-react";
import type { MouseEvent } from "react";

export type ItemActionId = "sell" | "upgrade" | "contract" | "withdraw" | "details";

const ACTION_META: Record<ItemActionId, { label: string; icon: typeof Wallet }> = {
  sell: { label: "Sell", icon: Wallet },
  upgrade: { label: "Use in Upgrade", icon: ArrowUpRight },
  contract: { label: "Use in Contract", icon: Handshake },
  withdraw: { label: "Withdraw", icon: Send },
  details: { label: "Details", icon: Info },
};

export const DEFAULT_ITEM_ACTIONS: ItemActionId[] = ["sell", "upgrade", "contract", "details"];

/**
 * The one action row for an item card. Every surface that offers per-item
 * actions renders this — there is no second, hover-only variant.
 */
export function ItemActions({
  ids = DEFAULT_ITEM_ACTIONS,
  disabledIds,
  onAction,
  className,
}: {
  ids?: ItemActionId[];
  disabledIds?: ItemActionId[];
  onAction: (id: ItemActionId, e: MouseEvent) => void;
  className?: string;
}) {
  if (!ids.length) return null;
  const locked = new Set(disabledIds ?? []);
  return (
    <div className={cn("mt-auto flex items-center gap-0.5 border-t border-line px-1 py-1", className)}>
      {ids.map((id) => {
        const action = ACTION_META[id];
        const Icon = action.icon;
        const disabled = locked.has(id);
        return (
          <button
            key={id}
            type="button"
            title={action.label}
            aria-label={action.label}
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (disabled) return;
              onAction(id, e);
            }}
            className={cn(
              "grid h-7 min-w-7 flex-1 place-items-center rounded-[var(--radius-xs)] text-mute",
              "transition-[background-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]",
              disabled
                ? "cursor-not-allowed opacity-35"
                : "hover:bg-white/[0.07] hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
