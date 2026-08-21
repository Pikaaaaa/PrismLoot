"use client";

import { ItemActions, type ItemActionId } from "@/components/inventory/ItemActions";
import { RarityChrome } from "@/components/ui/RarityChrome";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { isStickerItem } from "@/lib/itemCatalog";
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
  vault: "h-[10rem] sm:h-[11rem]",
};

const ART_PAD: Record<CardMode, number> = {
  compact: 6,
  md: 8,
  large: 12,
  vault: 14,
};

/** Hex weave scales with the art well so the lattice keeps the same visual weight. */
const HEX_TILE: Record<CardMode, string> = {
  compact: "16px 28px",
  md: "20px 35px",
  large: "26px 45px",
  vault: "28px 49px",
};

const BODY_PAD: Record<CardMode, string> = {
  compact: "px-2 py-1.5",
  md: "px-2.5 py-2",
  large: "px-3 py-2.5",
  vault: "px-2.5 py-2",
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
  muted,
  statusLabel,
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
  muted?: boolean;
  statusLabel?: string | null;
  className?: string;
}) {
  const { priceTick, displayCurrency } = useAppStore();
  void priceTick;
  void displayCurrency;

  const mode: CardMode = vault ? "vault" : compact ? "compact" : large ? "large" : "md";
  const wearless = isStickerItem(skin);
  const wear = showWear && !wearless ? skin.wear : undefined;
  const quote = getSkinPrice(skin.id, wear);
  const price = cardPriceLabel(quote, mode === "compact");
  const rarity = RARITY_META[skin.rarity];
  const showActions = Boolean(actions && onAction);
  const split = skin.name.includes("|");
  const weaponLabel = split ? skin.name.split("|")[0]?.trim() : String(skin.weapon);
  const finishLabel = split ? skin.name.split("|").slice(1).join("|").trim() : skin.name;

  const art = (
    <div
      className={cn("relative w-full shrink-0 overflow-hidden", ART_HEIGHT[mode])}
      style={{
        background: `radial-gradient(ellipse 85% 75% at 50% 42%, ${rarity.color}1c, transparent 68%), #0b0b0e`,
      }}
    >
      <span
        aria-hidden
        className="art-hex pointer-events-none absolute inset-0 z-[1] opacity-[0.055]"
        style={{ backgroundSize: HEX_TILE[mode] }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[1] grid place-items-center">
        <svg viewBox="0 0 64 64" fill="none" className="h-[70%] w-auto text-white/[0.05]">
          <polygon
            points="32,4 56.249,18 56.249,46 32,60 7.751,46 7.751,18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon
            points="32,14 48,24 32,50 16,24"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: "radial-gradient(ellipse 78% 70% at 50% 45%, transparent 45%, rgba(0,0,0,0.55))" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-12 bg-gradient-to-b from-white/[0.07] to-transparent"
      />
      <SkinVisual
        skin={skin}
        framed={false}
        chrome={false}
        showWear={false}
        pad={ART_PAD[mode]}
        className="relative z-[2] h-full w-full"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-1/2"
        style={{ background: `linear-gradient(to top, ${rarity.color}1a, transparent)` }}
      />
      <RarityChrome rarity={skin.rarity} />
      {showWear && !wearless ? (
        <span className="absolute bottom-2.5 left-2 z-[7] grid h-5 min-w-7 place-items-center rounded-[var(--radius-xs)] bg-void/85 px-1.5 text-[length:var(--type-micro)] font-semibold leading-none tracking-wide text-soft ring-1 ring-white/10">
          {WEAR_META[skin.wear].short}
        </span>
      ) : null}
      {skin.stattrak ? (
        <span className="absolute right-2 top-2 z-[7] grid h-5 place-items-center rounded-[var(--radius-xs)] bg-amber px-1.5 text-[length:var(--type-micro)] font-bold leading-none tracking-wider text-void">
          ST
        </span>
      ) : null}
      {pending ? (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[8] bg-void/45" />
          <span className="absolute left-2 top-2 z-[9] grid h-5 place-items-center whitespace-nowrap rounded-[var(--radius-xs)] border border-amber/40 bg-void/85 px-2 text-[length:var(--type-micro)] font-semibold leading-none text-amber">
            Processing
          </span>
        </>
      ) : statusLabel ? (
        <>
          {muted ? <div aria-hidden className="pointer-events-none absolute inset-0 z-[8] bg-void/40" /> : null}
          <span className="absolute left-2 top-2 z-[9] grid h-5 place-items-center whitespace-nowrap rounded-[var(--radius-xs)] border border-cyan/40 bg-void/85 px-2 text-[length:var(--type-micro)] font-semibold leading-none text-cyan">
            {statusLabel}
          </span>
        </>
      ) : null}
    </div>
  );

  const body = (
    <div className={cn("flex min-w-0 flex-col", vault ? "min-h-0 flex-1" : "shrink-0", BODY_PAD[mode])}>
      {mode === "compact" ? (
        <p className={cn("h-5 truncate font-semibold leading-5", NAME_SIZE[mode])} title={skin.name}>
          {skin.name}
        </p>
      ) : (
        <>
          <p className="h-4 truncate text-[length:var(--type-micro)] leading-4 text-mute" title={weaponLabel}>
            {weaponLabel}
          </p>
          <p className={cn("h-5 truncate font-semibold leading-5", NAME_SIZE[mode])} title={finishLabel}>
            {finishLabel}
          </p>
        </>
      )}
      <p className="mt-1 h-4 min-w-0 truncate text-[length:var(--type-micro)] font-semibold leading-4" style={{ color: rarity.color }}>
        {rarity.label}
        {chance != null ? <span className="tabular ml-1.5 font-normal text-mute">{formatDropChance(chance)}</span> : null}
      </p>
      <p
        className={cn(
          "skin-card-price mt-auto h-6 min-w-0 truncate pt-1 font-semibold leading-5 text-cyan",
          mode === "compact" ? null : "text-[length:var(--type-sm)]",
        )}
        title={formatQuotePrice(quote)}
      >
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
    "surface card-hover group relative flex w-full min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] text-left",
    vault && "h-full",
    onClick && !disabled && "cursor-pointer",
    selected && "border-cyan/40 bg-cyan/[0.05] ring-1 ring-cyan/50",
    disabled && "pointer-events-none opacity-40",
    muted && !disabled && "opacity-70",
    className,
  );
  const shellStyle = selected
    ? undefined
    : { boxShadow: `inset 0 0 0 1px ${rarity.color}2e, 0 10px 24px ${rarity.glow}` };

  // A card that owns its own action buttons cannot itself be a <button>.
  if (onClick && !actionRow) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        className={shell}
        style={shellStyle}
      >
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
      style={shellStyle}
      onClick={onClick && !disabled ? onClick : undefined}
      onKeyDown={onClick ? onKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={pending ? `${skin.name}, Processing` : statusLabel ? `${skin.name}, ${statusLabel}` : undefined}
    >
      {art}
      {body}
      {actionRow}
    </article>
  );
}
