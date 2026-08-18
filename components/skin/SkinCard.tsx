"use client";

import { ItemActions, type ItemActionId } from "@/components/inventory/ItemActions";
import { RarityChrome } from "@/components/ui/RarityChrome";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { RARITY_META, WEAR_META } from "@/lib/rarity";
import { convertPrice, formatCompactConverted } from "@/lib/services/prices/currency";
import { formatQuotePrice, getSkinPrice } from "@/lib/services/prices/priceProvider";
import { isValidMarketPrice } from "@/lib/services/prices/validate";
import { useAppStore } from "@/lib/store";
import type { Skin } from "@/lib/types";
import { cn, formatDropChance } from "@/lib/utils";
import type { KeyboardEvent, ReactNode } from "react";

type CardMode = "compact" | "md" | "large" | "vault";

/** Art wells are locked per mode so every card in a grid lines up. */
const ART_HEIGHT: Record<CardMode, string> = {
  compact: "h-[4.5rem]",
  md: "h-[5.5rem]",
  large: "h-[8.5rem]",
  vault: "h-[9.25rem] sm:h-[10.25rem]",
};

const ART_PAD: Record<CardMode, number> = {
  compact: 6,
  md: 8,
  large: 12,
  vault: 14,
};

const BODY_PAD: Record<CardMode, string> = {
  compact: "gap-1 px-2 py-1.5",
  md: "gap-1 px-2.5 py-2",
  large: "gap-1.5 px-3 py-2.5",
  vault: "gap-1.5 px-2.5 py-2.5",
};

const NAME_SIZE: Record<CardMode, string> = {
  compact: "text-[length:var(--type-meta)]",
  md: "text-[length:var(--type-meta)]",
  large: "text-[length:var(--type-sm)]",
  vault: "text-[length:var(--type-sm)]",
};

function cardPriceLabel(quote: ReturnType<typeof getSkinPrice>, compact?: boolean) {
  if (!quote.available || !isValidMarketPrice(quote.price)) return formatQuotePrice(quote);
  const display = convertPrice(quote.price);
  if (compact && Math.abs(display) >= 1000) return formatCompactConverted(quote.price);
  if (Math.abs(display) >= 10_000) return formatCompactConverted(quote.price);
  return formatQuotePrice(quote);
}

/**
 * The single skin card. Every mode shares one anatomy —
 * art well → name → condition/rarity → price (pinned) → optional actions —
 * so cards from different call sites still align inside the same grid.
 */
export function SkinCard({
  skin,
  chance,
  selected,
  onClick,
  compact,
  large,
  vault,
  showWear = true,
  disabled,
  footer,
  actions,
  actionIds,
  actionDisabledIds,
  onAction,
  pending,
  className,
}: {
  skin: Skin;
  chance?: number;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  large?: boolean;
  vault?: boolean;
  showWear?: boolean;
  disabled?: boolean;
  footer?: ReactNode;
  actions?: boolean;
  actionIds?: ItemActionId[];
  actionDisabledIds?: ItemActionId[];
  onAction?: (id: ItemActionId) => void;
  pending?: boolean;
  className?: string;
}) {
  const { priceTick, displayCurrency } = useAppStore();
  void priceTick;
  void displayCurrency;

  const mode: CardMode = vault ? "vault" : compact ? "compact" : large ? "large" : "md";
  const wear = showWear ? skin.wear : undefined;
  const quote = getSkinPrice(skin.id, wear);
  const price = cardPriceLabel(quote, mode === "compact");
  const rarity = RARITY_META[skin.rarity];
  const showActions = Boolean(actions && onAction);

  const art = (
    <div className={cn("relative w-full shrink-0 overflow-hidden bg-graphite", ART_HEIGHT[mode])}>
      <SkinVisual
        skin={skin}
        framed={false}
        chrome={false}
        showWear={false}
        pad={ART_PAD[mode]}
        className="h-full w-full"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-1/2"
        style={{ background: `linear-gradient(to top, ${rarity.color}22, transparent)` }}
      />
      <RarityChrome rarity={skin.rarity} />
      {showWear ? (
        <span className="absolute bottom-1.5 left-1.5 z-[7] rounded-[var(--radius-xs)] bg-void/75 px-1.5 py-0.5 text-[length:var(--type-micro)] font-semibold text-soft">
          {WEAR_META[skin.wear].short}
        </span>
      ) : null}
      {skin.stattrak ? (
        <span className="absolute right-1.5 top-1.5 z-[7] rounded-[var(--radius-xs)] bg-amber px-1.5 py-0.5 text-[length:var(--type-micro)] font-bold tracking-wider text-void">
          ST
        </span>
      ) : null}
      {pending ? (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[8] bg-void/45" />
          <span className="absolute left-1.5 top-1.5 z-[9] whitespace-nowrap rounded-full border border-amber/40 bg-void/85 px-2 py-0.5 text-[length:var(--type-micro)] font-semibold text-amber">
            Отправляется
          </span>
        </>
      ) : null}
    </div>
  );

  const body = (
    <div className={cn("flex min-w-0 flex-1 flex-col", BODY_PAD[mode])}>
      <p className={cn("truncate font-semibold leading-tight", NAME_SIZE[mode])} title={skin.name}>
        {skin.name}
      </p>
      <p className="flex min-w-0 items-center gap-1.5 text-[length:var(--type-micro)] leading-tight">
        <span className="truncate font-semibold" style={{ color: rarity.color }}>
          {rarity.label}
        </span>
        {chance != null ? <span className="tabular ml-auto shrink-0 text-mute">{formatDropChance(chance)}</span> : null}
      </p>
      <p className={cn("skin-card-price mt-auto min-w-0 truncate pt-1.5", mode === "compact" ? null : "text-[length:var(--type-sm)]")} title={formatQuotePrice(quote)}>
        {price}
      </p>
      {footer}
    </div>
  );

  const actionRow = showActions ? (
    <ItemActions
      ids={actionIds}
      disabledIds={actionDisabledIds}
      onAction={(id, e) => {
        e.stopPropagation();
        onAction?.(id);
      }}
    />
  ) : null;

  const shell = cn(
    "surface card-hover group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] text-left",
    onClick && !disabled && "cursor-pointer",
    selected && "border-cyan/40 bg-cyan/[0.05] ring-1 ring-cyan/50",
    disabled && "pointer-events-none opacity-40",
    className,
  );

  // A card that owns its own action buttons cannot itself be a <button>.
  if (onClick && !actionRow) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={shell}>
        {art}
        {body}
      </button>
    );
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!onClick || disabled) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick();
  }

  return (
    <article
      className={shell}
      onClick={onClick && !disabled ? onClick : undefined}
      onKeyDown={onClick ? onKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={pending ? `${skin.name}, Отправляется` : undefined}
    >
      {art}
      {body}
      {actionRow}
    </article>
  );
}
