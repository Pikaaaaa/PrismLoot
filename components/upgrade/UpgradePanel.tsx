"use client";

import { SkinCard } from "@/components/skin/SkinCard";
import { RarityPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyWellMark } from "@/components/ui/EmptyWellMark";
import { SearchInput, SelectField } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Pager } from "@/components/ui/Pager";
import { SkinCardSkeleton } from "@/components/ui/Skeleton";
import { UpgradeControls } from "@/components/upgrade/UpgradeControls";
import {
  UpgradeMachine,
  deriveUpgradeView,
  landAngleFor,
  nextSpin,
  type UpgradePhase,
} from "@/components/upgrade/UpgradeMachine";
import { UpgradeStakeStack } from "@/components/upgrade/UpgradeStakeStack";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { SKINS } from "@/data/skins";
import { SELL_COEFFICIENT, UPGRADE_MAX_CHANCE, UPGRADE_MAX_ITEMS, UPGRADE_MIN_CHANCE, UPGRADE_RTP } from "@/lib/economy/config";
import {
  computeUpgradeChance,
  formatUpgradeChance,
  matchesQuery,
  previewUpgrade,
  pricedCatalog,
} from "@/lib/engine/upgrade";
import { clearPendingUpgrade, readPendingUpgrade, writePendingUpgrade } from "@/lib/pending";
import { WEAR_META } from "@/lib/rarity";
import { convertPrice } from "@/lib/services/prices/currency";
import { formatQuotePrice, getSkinPrice, listingWearFor, sellValueUsd } from "@/lib/services/prices/priceProvider";
import { canSellDrop, isInVault } from "@/lib/inventoryOwnership";
import { useAppStore } from "@/lib/store";
import type { InventoryItem, Skin } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { ChevronsUp } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 6;
const TARGET_BAND_REL = 0.08;
const TARGET_BAND_NEAREST = 12;

type PricedRow = { skin: Skin; price: number };

function livePricedSkins(): PricedRow[] {
  return SKINS.flatMap((skin) => {
    const quote = getSkinPrice(skin.id, listingWearFor(skin.id));
    if (!quote.available || quote.price == null || !(quote.price > 0)) return [];
    return [{ skin, price: quote.price }];
  });
}

function skinsAboveInput(inputValue: number): PricedRow[] {
  if (!(inputValue > 0)) return [];
  return livePricedSkins().filter((row) => row.price > inputValue);
}

function minLegalUpgradePrice(inputValue: number): number {
  return (inputValue * 100 * UPGRADE_RTP) / UPGRADE_MAX_CHANCE;
}

/** Target catalog price for a chip. Null when the request would be a downgrade. */
function chipTargetPrice(inputValue: number, multiplier: number | null, chancePct: number | null): number | null {
  if (!(inputValue > 0)) return null;
  let targetPrice = 0;
  if (multiplier != null && multiplier > 0) targetPrice = inputValue * multiplier;
  else if (chancePct != null && chancePct > 0) targetPrice = inputValue / (chancePct / 100);
  if (!(targetPrice > inputValue)) return null;
  const implied = (inputValue / targetPrice) * 100 * UPGRADE_RTP;
  if (implied > UPGRADE_MAX_CHANCE) return minLegalUpgradePrice(inputValue);
  return targetPrice;
}

function valueBand(pool: PricedRow[], targetPrice: number): PricedRow[] {
  if (!pool.length || !(targetPrice > 0)) return [];
  const nearby = pool.filter((row) => Math.abs(row.price - targetPrice) / targetPrice <= TARGET_BAND_REL);
  if (nearby.length >= 2) return nearby;
  return [...pool]
    .sort(
      (a, b) =>
        Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice) || a.skin.id.localeCompare(b.skin.id),
    )
    .slice(0, TARGET_BAND_NEAREST);
}

function nextInBand(band: PricedRow[], currentId: string | null, targetPrice: number): PricedRow | null {
  if (!band.length) return null;
  const sorted = [...band].sort((a, b) => a.price - b.price || a.skin.id.localeCompare(b.skin.id));
  if (sorted.length === 1) return sorted[0] ?? null;
  const idx = currentId ? sorted.findIndex((row) => row.skin.id === currentId) : -1;
  if (idx >= 0) return sorted[(idx + 1) % sorted.length] ?? null;
  return sorted.reduce((best, row) =>
    Math.abs(row.price - targetPrice) < Math.abs(best.price - targetPrice) ? row : best,
  );
}

function stakeOf(item: InventoryItem) {
  const q = getSkinPrice(item.id, item.wear);
  return q.available && q.price != null ? q.price : null;
}

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

function maxExtraStake(wallet: number, skinsValue: number, targetValue: number | null) {
  const walletCap = Math.max(0, wallet);
  if (!(targetValue && targetValue > 0)) return walletCap;
  const capByChance = (targetValue * UPGRADE_MAX_CHANCE) / (100 * UPGRADE_RTP);
  const capByDowngrade = targetValue - 0.01;
  const maxInput = Math.min(capByChance, capByDowngrade);
  return Math.max(0, Math.min(walletCap, +(maxInput - skinsValue).toFixed(2)));
}

export function UpgradePanel() {
  const store = useAppStore();
  const params = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const from = params.get("from");
    return from ? [from] : [];
  });
  const [frozenInputs, setFrozenInputs] = useState<InventoryItem[]>([]);
  const [target, setTarget] = useState<Skin | null>(null);
  const [invQuery, setInvQuery] = useState("");
  const [catQuery, setCatQuery] = useState("");
  const [fromPrice, setFromPrice] = useState("");
  const [toPrice, setToPrice] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [catalogPage, setCatalogPage] = useState(0);
  const [invPage, setInvPage] = useState(0);
  const [extraStake, setExtraStake] = useState(0);
  const [phase, setPhase] = useState<UpgradePhase>("idle");
  const [gained, setGained] = useState<InventoryItem | null>(null);
  const [wheelDeg, setWheelDeg] = useState(0);
  const [spinMs, setSpinMs] = useState(4200);
  const [frozenChance, setFrozenChance] = useState<number | null>(null);
  const [intentMult, setIntentMult] = useState<number | null>(null);
  const [intentChance, setIntentChance] = useState<number | null>(null);
  const [spinVisibleIds, setSpinVisibleIds] = useState<ReadonlySet<string> | null>(null);
  const restoredUp = useRef(false);
  const appliedFrom = useRef<string | null>(null);
  const revealCommitted = useRef(false);

  const wallet = store.user && Number.isFinite(store.balance) ? Math.max(0, store.balance) : 0;
  const liveSelected = store.inventory.filter((i) => selectedIds.includes(i.instanceId));
  const selected = phase === "idle" ? liveSelected : frozenInputs.length ? frozenInputs : liveSelected;
  const pricedSelected = selected.every((item) => stakeOf(item) != null);
  const skinsValue = selected.reduce((sum, item) => sum + (stakeOf(item) ?? 0), 0);
  const listedWear = target ? listingWearFor(target.id) : undefined;
  const targetQuote = target ? getSkinPrice(target.id, listedWear) : null;
  const targetValue = targetQuote?.available && targetQuote.price != null ? targetQuote.price : 0;
  const extraCap = selected.length ? maxExtraStake(wallet, skinsValue, targetValue > 0 ? targetValue : null) : 0;
  const extra = Math.min(Math.max(0, Number.isFinite(extraStake) ? extraStake : 0), extraCap);
  const inputValue = pricedSelected && selected.length ? +(skinsValue + extra).toFixed(2) : 0;
  const isDowngrade = targetValue > 0 && inputValue > 0 && targetValue <= inputValue;

  const engine = useMemo(() => {
    void store.priceTick;
    if (!selected.length || !target || !pricedSelected || !(inputValue > 0) || isDowngrade) return null;
    try {
      return previewUpgrade(
        selected.map((s) => s.id),
        target.id,
        extra,
        selected.map((s) => s.wear),
        listingWearFor(target.id),
      );
    } catch {
      return null;
    }
  }, [selected, target, inputValue, extra, pricedSelected, isDowngrade, store.priceTick]);

  const liveChance = Math.min(UPGRADE_MAX_CHANCE, engine?.chance ?? 0);
  const chance = Math.min(UPGRADE_MAX_CHANCE, frozenChance ?? liveChance);

  const catalogOpen =
    catQuery.trim().length > 0 || fromPrice.trim().length > 0 || toPrice.trim().length > 0 || inputValue > 0;

  const catalog = useMemo(() => {
    void store.priceTick;
    if (!catalogOpen) return [];
    const q = catQuery.trim();
    const min = fromPrice.trim() ? Number(fromPrice) : null;
    const max = toPrice.trim() ? Number(toPrice) : null;
    return pricedCatalog()
      .filter((row) => matchesQuery(row.skin, q))
      .filter((row) => (min != null && Number.isFinite(min) ? convertPrice(row.price) >= min : true))
      .filter((row) => (max != null && Number.isFinite(max) ? convertPrice(row.price) <= max : true))
      .filter((row) => (inputValue > 0 ? row.price > inputValue : true))
      .sort((a, b) => (sortDir === "asc" ? a.price - b.price : b.price - a.price));
  }, [catalogOpen, catQuery, fromPrice, toPrice, sortDir, inputValue, store.priceTick, store.displayCurrency]);

  const visibleInventory = useMemo(() => {
    const live = store.inventory.filter((item) => isInVault(item));
    if (phase !== "rolling") return live;
    return live.filter((item) => {
      if (gained && item.instanceId === gained.instanceId) return false;
      if (spinVisibleIds) return spinVisibleIds.has(item.instanceId);
      return true;
    });
  }, [phase, spinVisibleIds, store.inventory, gained]);

  const inventorySorted = useMemo(() => {
    void store.priceTick;
    const q = invQuery.trim();
    return [...visibleInventory]
      .filter((item) => matchesQuery(item, q))
      .sort((a, b) => (getSkinPrice(b.id, b.wear).price ?? 0) - (getSkinPrice(a.id, a.wear).price ?? 0));
  }, [visibleInventory, store.priceTick, invQuery]);

  const catalogPages = Math.max(1, Math.ceil(catalog.length / PAGE_SIZE));
  const invPages = Math.max(1, Math.ceil(inventorySorted.length / PAGE_SIZE));
  const catalogPageSafe = Math.min(catalogPage, catalogPages - 1);
  const invPageSafe = Math.min(invPage, invPages - 1);
  const catalogSlice = catalog.slice(catalogPageSafe * PAGE_SIZE, catalogPageSafe * PAGE_SIZE + PAGE_SIZE);
  const inventorySlice = inventorySorted.slice(invPageSafe * PAGE_SIZE, invPageSafe * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setCatalogPage(0);
  }, [catQuery, fromPrice, toPrice, sortDir, inputValue]);

  useEffect(() => {
    setInvPage(0);
  }, [invQuery]);

  useEffect(() => {
    setExtraStake((n) => Math.min(Math.max(0, n), extraCap));
  }, [extraCap]);

  useEffect(() => {
    if (phase !== "idle") return;
    const from = params.get("from");
    const valid = new Set(
      store.inventory.filter((item) => isInVault(item)).map((item) => item.instanceId),
    );
    setSelectedIds((prev) => {
      let next = prev.filter((id) => valid.has(id));
      if (from && appliedFrom.current !== from && valid.has(from)) {
        appliedFrom.current = from;
        if (!next.includes(from)) next = [from, ...next].slice(0, UPGRADE_MAX_ITEMS);
      }
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [phase, params, store.inventory]);

  useEffect(() => {
    if (!store.hydrated || restoredUp.current) return;
    restoredUp.current = true;
    const row = readPendingUpgrade();
    if (!row) return;
    if (row.item) setGained(row.item);
    const leftover = (row.durationMs || 0) - (Date.now() - row.startedAt);
    const tgt = SKINS.find((s) => s.id === row.targetSkinId);
    if (tgt) setTarget(tgt);
    setFrozenChance(Math.min(UPGRADE_MAX_CHANCE, row.chance));
    const concealId = row.item?.instanceId;
    setSpinVisibleIds(
      new Set(store.inventory.map((item) => item.instanceId).filter((id) => id !== concealId)),
    );
    const finish = () => {
      commitUpgradeReveal({
        success: !!row.success,
        item: row.item,
        sources: row.sourceNames,
        chance: Math.min(UPGRADE_MAX_CHANCE, row.chance),
        targetName: row.targetName,
        inputValue: row.inputValue ?? row.extraStake,
      });
      clearPendingUpgrade();
    };
    if (leftover > 120) {
      setPhase("rolling");
      setSpinMs(leftover);
      setWheelDeg((d) => nextSpin(d, landAngleFor(row.success, row.chance), leftover > 1600 ? 4 : 1));
      void (async () => {
        await sleep(leftover + 80);
        finish();
      })();
      return;
    }
    finish();
  }, [store.hydrated]);

  const locked = phase === "rolling";
  const playable = liveChance >= UPGRADE_MIN_CHANCE - 0.009 && liveChance <= UPGRADE_MAX_CHANCE + 0.009;
  const tooLow = liveChance > 0 && liveChance < UPGRADE_MIN_CHANCE - 0.009;
  const unpriced = selected.length > 0 && !pricedSelected;
  const ready = selected.length > 0 && !!target && playable && !isDowngrade && !unpriced;
  const view = deriveUpgradeView({
    phase,
    hasItems: selected.length > 0,
    hasTarget: !!target,
    ready,
  });
  const canRoll = ready && phase !== "rolling" && phase !== "success" && phase !== "fail";

  const blockReason = !selected.length
    ? "Select an item to stake"
    : unpriced
      ? "Price unavailable on an input skin"
      : !target
        ? "Select a target"
        : isDowngrade
          ? "Target must be worth more than your stake"
          : tooLow
            ? `Chance below ${UPGRADE_MIN_CHANCE}% — cheaper target or more stake`
            : null;

  function resetRound() {
    revealCommitted.current = false;
    setFrozenChance(null);
    setGained(null);
    setFrozenInputs([]);
    setSpinVisibleIds(null);
    setPhase("idle");
  }

  function commitUpgradeReveal(input: {
    success: boolean;
    item: InventoryItem | null;
    sources: string;
    chance: number;
    targetName: string;
    inputValue: number;
  }) {
    if (revealCommitted.current) return;
    revealCommitted.current = true;
    setSpinVisibleIds(null);
    if (input.success && input.item) {
      store.addItem(input.item);
      store.addHistory({
        kind: "upgrade",
        title: "Upgrade success",
        detail: `${input.sources} → ${input.item.name}`,
        amount: getSkinPrice(input.item.id, input.item.wear).price ?? 0,
        sourceName: input.sources,
        targetName: input.item.name,
        chance: input.chance,
        result: "success",
      });
      if (store.user) {
        store.pushDrop({
          kind: "upgrade",
          user: store.user.username,
          avatarHue: store.user.avatarHue,
          caseName: "Upgrade",
          skin: input.item,
        });
      }
      setGained(input.item);
      store.toast({ title: "Upgrade successful", detail: input.item.name, tone: "rare" });
      setPhase("success");
      return;
    }
    store.addHistory({
      kind: "upgrade",
      title: "Upgrade failed",
      detail: input.sources,
      amount: -input.inputValue,
      sourceName: input.sources,
      targetName: input.targetName,
      chance: input.chance,
      result: "fail",
    });
    store.toast({ title: "Upgrade failed", detail: "Input consumed", tone: "err" });
    setPhase("fail");
  }

  function pickTarget(skin: Skin) {
    if (locked) return;
    setTarget(skin);
    setIntentMult(null);
    setIntentChance(null);
    if (phase === "fail" || phase === "success") resetRound();
  }

  function applyDesired(chanceHint: number | null, multHint: number | null) {
    if (locked || inputValue <= 0) return;
    const desiredPrice = chipTargetPrice(inputValue, multHint, chanceHint);
    if (desiredPrice == null) {
      const label = chanceHint != null ? `${chanceHint}%` : multHint != null ? `x${multHint}` : "that price";
      store.toast({
        title: "No target in that range",
        detail: `Nothing in the catalog matches ${label} for this stake.`,
        tone: "warn",
      });
      return;
    }
    const pool = skinsAboveInput(inputValue);
    const band = valueBand(pool, desiredPrice);
    const hit = nextInBand(band, target?.id ?? null, desiredPrice);
    if (!hit) {
      const label = chanceHint != null ? `${chanceHint}%` : multHint != null ? `x${multHint}` : "that price";
      store.toast({
        title: "No target in that range",
        detail: `Nothing in the catalog matches ${label} for this stake.`,
        tone: "warn",
      });
      return;
    }
    if (target?.id === hit.skin.id) {
      store.toast({ title: "No other skin at this value", tone: "warn" });
      setIntentMult(multHint);
      setIntentChance(chanceHint);
      return;
    }
    setTarget(hit.skin);
    setIntentMult(multHint);
    setIntentChance(chanceHint);
    if (phase === "fail" || phase === "success") resetRound();
  }

  function shuffleTarget() {
    if (locked || inputValue <= 0) return;
    const pool = skinsAboveInput(inputValue);
    if (!pool.length) {
      store.toast({ title: "No target in that range", tone: "warn" });
      return;
    }
    const others = target ? pool.filter((row) => row.skin.id !== target.id) : pool;
    if (!others.length) {
      store.toast({ title: "No other skin at this value", tone: "warn" });
      return;
    }
    const hit = others[Math.floor(Math.random() * others.length)];
    if (!hit) return;
    setTarget(hit.skin);
    setIntentMult(null);
    setIntentChance(null);
    if (phase === "fail" || phase === "success") resetRound();
  }

  function toggleItem(item: InventoryItem) {
    if (locked || !isInVault(item)) return;
    setSelectedIds((prev) => {
      if (prev.includes(item.instanceId)) return prev.filter((id) => id !== item.instanceId);
      if (prev.length >= UPGRADE_MAX_ITEMS) {
        store.toast({ title: `Select up to ${UPGRADE_MAX_ITEMS} items`, tone: "warn" });
        return prev;
      }
      return [...prev, item.instanceId];
    });
    resetRound();
  }

  async function run() {
    if (locked) return;
    if (!selected.length) {
      store.toast({ title: "Select items first", tone: "warn" });
      return;
    }
    if (isDowngrade) {
      store.toast({ title: "Downgrade blocked", detail: "Target must be worth more than your stake.", tone: "warn" });
      return;
    }
    if (!target || !engine || !playable) {
      store.toast({
        title: tooLow ? `Chance below ${UPGRADE_MIN_CHANCE}%` : "Select a target",
        detail: tooLow ? "Pick a cheaper target or add more stake." : undefined,
        tone: "warn",
      });
      return;
    }
    if (!store.user) {
      store.toast({ title: "Sign in with Steam", tone: "warn" });
      return;
    }
    if (extra > wallet) {
      store.toast({ title: "Not enough balance", tone: "err" });
      return;
    }
    setFrozenInputs(selected);
    setSpinVisibleIds(new Set(store.inventory.map((item) => item.instanceId)));
    setPhase("rolling");
    setFrozenChance(engine.chance);
    setGained(null);
    revealCommitted.current = false;
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceInstanceIds: selected.map((s) => s.instanceId),
          sourceSkinIds: selected.map((s) => s.id),
          sourceWears: selected.map((s) => s.wear),
          targetSkinId: target.id,
          targetWear: listingWearFor(target.id),
          requestedChance: engine.chance,
          extraStake: extra,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        success?: boolean;
        chance?: number;
        item?: InventoryItem | null;
        error?: string;
        inputValue?: number;
        targetValue?: number;
        extraStake?: number;
      };
      if (!data.ok || data.chance == null) {
        setPhase("idle");
        setFrozenChance(null);
        setFrozenInputs([]);
        setSpinVisibleIds(null);
        store.toast({ title: "Upgrade rejected", detail: data.error, tone: "err" });
        return;
      }
      const confirmed = Math.min(UPGRADE_MAX_CHANCE, data.chance);
      const duration = store.reduceMotion ? 900 : 4800;
      const consumed = selected.map((s) => s.instanceId);
      const sources = selected.map((s) => s.name).join(", ");
      const gainedItem = data.success && data.item ? data.item : null;
      // Stake + extra commit now; grant the won skin only when the dial lands.
      if (!store.applyUpgrade({ extra, removeIds: consumed, item: null })) {
        setPhase("idle");
        setFrozenChance(null);
        setFrozenInputs([]);
        setSpinVisibleIds(null);
        return;
      }
      setFrozenChance(confirmed);
      writePendingUpgrade({
        consumedIds: consumed,
        extraStake: extra,
        success: !!data.success,
        chance: confirmed,
        targetSkinId: target.id,
        targetName: target.name,
        item: gainedItem,
        sourceNames: sources,
        startedAt: Date.now(),
        durationMs: duration,
        inputValue: data.inputValue ?? inputValue,
      });
      store.bumpStat("upgrades");
      setGained(gainedItem);
      setSpinMs(duration);
      setWheelDeg((d) => nextSpin(d, landAngleFor(!!data.success, confirmed), store.reduceMotion ? 3 : 10));
      await sleep(duration + 120);

      commitUpgradeReveal({
        success: !!gainedItem,
        item: gainedItem,
        sources,
        chance: confirmed,
        targetName: target.name,
        inputValue: data.inputValue ?? inputValue,
      });
      setSelectedIds([]);
      setExtraStake(0);
      clearPendingUpgrade();
    } catch {
      setPhase("idle");
      setFrozenChance(null);
      setFrozenInputs([]);
      setSpinVisibleIds(null);
      store.toast({ title: "Upgrade failed to start", tone: "err" });
    }
  }

  function keep() {
    clearPendingUpgrade();
    if (gained) setSelectedIds([gained.instanceId]);
    setGained(null);
    setFrozenChance(null);
    setFrozenInputs([]);
    setSpinVisibleIds(null);
    setPhase("idle");
  }

  function sellGained() {
    if (!gained) {
      keep();
      return;
    }
    if (!canSellDrop(gained.instanceId, store.inventory)) {
      store.toast({ title: "Item no longer in inventory", tone: "warn" });
      keep();
      return;
    }
    const value = sellValueUsd(gained.id, SELL_COEFFICIENT, gained.wear);
    if (value == null) {
      store.toast({ title: "Price unavailable", detail: "Cannot sell without a market quote.", tone: "err" });
      return;
    }
    store.removeItems([gained.instanceId], { [gained.instanceId]: value });
    store.credit(value);
    store.addHistory({ kind: "sell", title: "Sold item", detail: gained.name, amount: value });
    store.toast({ title: "Sold", detail: `${gained.name} · ${formatMoney(value)}`, tone: "ok" });
    clearPendingUpgrade();
    setGained(null);
    setFrozenChance(null);
    setFrozenInputs([]);
    setSpinVisibleIds(null);
    setPhase("idle");
  }

  const chipDisabled = !selected.length || locked || !(inputValue > 0) || phase === "success";

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", locked && "select-none")} aria-busy={locked}>
      <div className={cn("surface p-3", locked && "pointer-events-none")}>
        <div className="upgrade-stage">
          <div className="upgrade-col-inv">
            <UpgradeStakeStack
              items={selected}
              max={UPGRADE_MAX_ITEMS}
              extra={extra}
              maxExtra={extraCap}
              onRemove={toggleItem}
              onExtra={(n) => setExtraStake(Number.isFinite(n) ? n : 0)}
              locked={locked}
            />
          </div>

          <div className="upgrade-col-machine">
            <UpgradeMachine
              view={view}
              chance={chance}
              wheelDeg={wheelDeg}
              spinMs={spinMs}
              reduceMotion={store.reduceMotion}
            />
            <div className="mt-2.5 flex w-full min-w-0 flex-col gap-2">
              {phase === "success" && gained ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" fullWidth onClick={keep}>
                    Keep
                  </Button>
                  <Button size="lg" fullWidth variant="ghost" onClick={sellGained}>
                    Sell
                  </Button>
                </div>
              ) : phase === "fail" ? (
                <Button size="lg" fullWidth variant="secondary" onClick={resetRound}>
                  Stake again
                </Button>
              ) : (
                <Button
                  size="lg"
                  fullWidth
                  disabled={!canRoll}
                  loading={locked}
                  icon={<ChevronsUp className="h-4 w-4" />}
                  onClick={() => void run()}
                >
                  {locked ? "Rolling" : "Upgrade"}
                </Button>
              )}
              {blockReason && phase === "idle" ? <p className="meta text-center">{blockReason}</p> : null}
            </div>
          </div>

          <div className="upgrade-col-target">
            <p className="label mb-1.5">Select the item you want</p>
            <div className="upgrade-well">
              {target ? (
                <SkinVisual
                  skin={target}
                  framed={false}
                  chrome={false}
                  showWear={false}
                  pad={8}
                  className="h-full w-full"
                />
              ) : (
                <EmptyWellMark />
              )}
            </div>
            {target ? (
              <div className="mt-1.5 min-w-0">
                <p className="truncate text-sm font-semibold" title={target.name}>
                  {target.name}
                </p>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <RarityPill rarity={target.rarity} />
                  <span className="skin-card-price ml-auto shrink-0">
                    {targetQuote ? formatQuotePrice(targetQuote) : "—"}
                  </span>
                </div>
              </div>
            ) : null}
            {phase !== "success" && phase !== "fail" ? (
              <div className="mt-2">
                <UpgradeControls
                  disabled={chipDisabled}
                  intentMult={intentMult}
                  intentChance={intentChance}
                  illegalMult={(m) => chipTargetPrice(inputValue, m, null) == null}
                  illegalChance={(n) => chipTargetPrice(inputValue, null, n) == null}
                  onMult={(m) => applyDesired(null, m)}
                  onChance={(n) => applyDesired(n, null)}
                  onShuffle={shuffleTarget}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="upgrade-panes">
        <section className="upgrade-pane">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate">My items ({store.hydrated ? visibleInventory.length : "—"})</h2>
            <span className="ml-auto w-full min-w-0 sm:w-40">
              <SearchInput
                value={invQuery}
                onChange={(e) => setInvQuery(e.target.value)}
                placeholder="Search"
                compact
              />
            </span>
          </div>
          {!store.hydrated ? (
            <div className="upgrade-grid">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <SkinCardSkeleton key={i} />
              ))}
            </div>
          ) : visibleInventory.length === 0 ? (
            <EmptyState
              compact
              className="upgrade-pane-empty"
              title="No items available to upgrade"
              action={
                <Link href="/cases">
                  <Button size="sm">Open a case</Button>
                </Link>
              }
            />
          ) : inventorySorted.length === 0 ? (
            <EmptyState compact className="upgrade-pane-empty" title="No items match this search." />
          ) : (
            <>
              <div className="upgrade-grid">
                {inventorySlice.map((item) => (
                  <SkinCard
                    key={item.instanceId}
                    skin={item}
                    selected={selectedIds.includes(item.instanceId)}
                    onClick={() => toggleItem(item)}
                  />
                ))}
              </div>
              <Pager page={invPageSafe} pageCount={invPages} onPage={setInvPage} className="mt-2" />
            </>
          )}
        </section>

        <section className="upgrade-pane">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate">Select an item</h2>
            <SelectField
              value={sortDir}
              aria-label="Sort by price"
              className="ml-auto min-w-0"
              onChange={(e) => setSortDir(e.target.value === "asc" ? "asc" : "desc")}
            >
              <option value="desc">Price high</option>
              <option value="asc">Price low</option>
            </SelectField>
            <input
              inputMode="decimal"
              value={fromPrice}
              onChange={(e) => setFromPrice(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="From"
              aria-label="Price from"
              className="field h-8 w-16 min-w-0"
              disabled={locked}
            />
            <input
              inputMode="decimal"
              value={toPrice}
              onChange={(e) => setToPrice(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="To"
              aria-label="Price to"
              className="field h-8 w-16 min-w-0"
              disabled={locked}
            />
            <span className="w-full min-w-0 sm:w-36">
              <SearchInput
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
                placeholder="Search"
                compact
              />
            </span>
          </div>
          {!catalogOpen ? (
            <EmptyState
              compact
              className="upgrade-pane-empty"
              title="No targets yet"
              detail="Use search or pick a multiplier"
            />
          ) : catalog.length === 0 ? (
            <EmptyState
              compact
              className="upgrade-pane-empty"
              title="No targets in this range."
              detail="Widen the filters or change your stake."
            />
          ) : (
            <>
              <div className="upgrade-grid">
                {catalogSlice.map((row) => {
                  const tooCheap = inputValue > 0 && row.price <= inputValue;
                  return (
                    <SkinCard
                      key={row.skin.id}
                      skin={row.skin}
                      showWear={false}
                      selected={target?.id === row.skin.id}
                      disabled={tooCheap}
                      onClick={() => pickTarget(row.skin)}
                      footer={
                        inputValue > 0 ? (
                          <p className="meta tabular">
                            {tooCheap ? "—" : formatUpgradeChance(computeUpgradeChance(inputValue, row.price))}
                          </p>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
              <Pager page={catalogPageSafe} pageCount={catalogPages} onPage={setCatalogPage} className="mt-2" />
            </>
          )}
        </section>
      </div>

      <Modal
        open={phase === "success" && !!gained}
        onClose={keep}
        title="Upgrade successful"
        description={gained ? gained.name : undefined}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="lg" onClick={keep}>
              Keep
            </Button>
            <Button type="button" size="lg" variant="ghost" onClick={sellGained}>
              Sell
              {gained && sellValueUsd(gained.id, SELL_COEFFICIENT, gained.wear) != null
                ? ` · ${formatMoney(sellValueUsd(gained.id, SELL_COEFFICIENT, gained.wear)!)}`
                : ""}
            </Button>
          </div>
        }
      >
        {gained ? <UpgradeWinCard item={gained} /> : null}
      </Modal>
    </div>
  );
}

function UpgradeWinCard({ item }: { item: InventoryItem }) {
  const quote = getSkinPrice(item.id, item.wear);
  return (
    <div className="text-center">
      <RarityPill rarity={item.rarity} />
      <SkinVisual
        skin={item}
        framed={false}
        chrome={false}
        showWear={false}
        pad={10}
        className="mx-auto mt-3 h-40 w-full max-w-sm overflow-hidden rounded-[var(--radius-md)] bg-graphite"
      />
      <p className="font-display mt-4 text-xl font-bold leading-snug">{item.name}</p>
      <p className="meta mt-1">{WEAR_META[item.wear].label}</p>
      <p className="price mt-2 text-cyan">{formatQuotePrice(quote)}</p>
    </div>
  );
}
