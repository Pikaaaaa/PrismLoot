"use client";

import { ContractResult, type ContractPhase } from "@/components/contract/ContractResult";
import { ContractSlot } from "@/components/contract/ContractSlot";
import { SignaturePad } from "@/components/contract/SignaturePad";
import { SkinCard } from "@/components/skin/SkinCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput, SelectField } from "@/components/ui/FilterBar";
import { Pager } from "@/components/ui/Pager";
import { Price } from "@/components/ui/Price";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Skeleton, SkinCardSkeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { previewContract } from "@/lib/engine/contract";
import { CONTRACT_MAX_ITEMS, CONTRACT_MIN_ITEMS } from "@/lib/economy/config";
import { isStickerItem } from "@/lib/itemCatalog";
import { isInVault } from "@/lib/inventoryOwnership";
import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import { useAppStore } from "@/lib/store";
import type { InventoryItem } from "@/lib/types";
import { formatBalance, formatMoney } from "@/lib/utils";
import { CircleDollarSign, CircleHelp, Handshake, Plus, Shuffle, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const SLOTS = CONTRACT_MAX_ITEMS;
const PAGE_SIZE = 9;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function skinValue(item: InventoryItem) {
  return getSkinPrice(item.id, item.wear).price ?? 0;
}

export function ContractPanel() {
  const store = useAppStore();
  const [slots, setSlots] = useState<Array<InventoryItem | null>>(Array(SLOTS).fill(null));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [extra, setExtra] = useState(0);
  const [hasInk, setHasInk] = useState(false);
  const [padReset, setPadReset] = useState(0);
  const [reward, setReward] = useState<InventoryItem | null>(null);
  const [profit, setProfit] = useState(0);
  const [phase, setPhase] = useState<ContractPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = slots.filter(Boolean) as InventoryItem[];
  const selectedIds = useMemo(() => new Set(selected.map((item) => item.instanceId)), [selected]);
  const wallet = store.user ? store.balance : 0;
  const extraCap = store.user ? Math.max(0, wallet) : 0;
  const extraStake = Math.min(extra, extraCap);

  const preview = useMemo(() => {
    if (selected.length < CONTRACT_MIN_ITEMS) return null;
    try {
      return previewContract(
        selected.map((item) => item.id),
        extraStake,
      );
    } catch {
      return null;
    }
  }, [selected, extraStake, store.priceTick, store.displayCurrency]);

  const stakedValue = useMemo(
    () => selected.reduce((sum, item) => sum + skinValue(item), 0),
    [selected, store.priceTick, store.displayCurrency],
  );
  const contractSum = stakedValue + extraStake;

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return store.inventory
      .filter((item) => {
        if (!isInVault(item)) return false;
        if (isStickerItem(item)) return false;
        if (selectedIds.has(item.instanceId)) return false;
        if (
          needle &&
          !item.name.toLowerCase().includes(needle) &&
          !item.weapon.toLowerCase().includes(needle)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => skinValue(b) - skinValue(a));
  }, [store.inventory, store.priceTick, store.displayCurrency, selectedIds, query]);

  const pages = Math.max(1, Math.ceil(available.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pages - 1);
  const pageSlice = available.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const vaultCount = store.inventory.filter(isInVault).length;
  const shortOnBoard = selected.length < CONTRACT_MIN_ITEMS;
  const needed = Math.max(0, CONTRACT_MIN_ITEMS - selected.length);
  const boardFull = selected.length >= SLOTS;
  const canSign = !busy && !shortOnBoard && hasInk;
  const deskOpen = phase === "idle";

  function put(item: InventoryItem) {
    if (busy || boardFull || !isInVault(item) || isStickerItem(item)) return;
    setSlots((prev) => {
      const i = prev.findIndex((slot) => !slot);
      if (i < 0) return prev;
      const next = [...prev];
      next[i] = item;
      return next;
    });
    if (phase === "reveal" || phase === "error") {
      setPhase("idle");
      setReward(null);
      setError(null);
    }
  }

  function clear(index: number) {
    if (busy) return;
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  async function run() {
    if (!store.user) {
      store.toast({ title: "Sign in with Steam", tone: "warn" });
      return;
    }
    if (selected.length < CONTRACT_MIN_ITEMS) {
      store.toast({ title: `Need at least ${CONTRACT_MIN_ITEMS} items`, tone: "warn" });
      return;
    }
    if (!hasInk) {
      store.toast({ title: "Sign the pad first", tone: "warn" });
      return;
    }
    if (extraStake > wallet) {
      store.toast({ title: "Not enough balance", tone: "err" });
      return;
    }
    setBusy(true);
    setError(null);
    setReward(null);
    setPhase("forging");
    const started = Date.now();
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skinIds: selected.map((item) => item.id),
          instanceIds: selected.map((item) => item.instanceId),
          extraStake,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        item?: InventoryItem;
        profit?: number;
        error?: string;
      };
      const minWait = store.reduceMotion ? 400 : 2200;
      await sleep(Math.max(0, minWait - (Date.now() - started)));
      if (!data.ok || !data.item) {
        setBusy(false);
        setPhase("error");
        setError(data.error ?? "The contract was rejected.");
        store.toast({ title: "Contract rejected", detail: data.error, tone: "err" });
        return;
      }
      store.removeItems(selected.map((item) => item.instanceId), undefined, "contract");
      store.addItem(data.item);
      if (extraStake > 0) store.spend(extraStake);
      store.bumpStat("contracts");
      const stake = selected.reduce((sum, item) => sum + item.price, 0);
      store.applyWagerVolume(stake);
      const pnl = data.profit ?? 0;
      store.addHistory({
        kind: "contract",
        title: pnl >= 0 ? "Contract profit" : "Contract loss",
        detail: data.item.name,
        amount: pnl,
        result: pnl >= 0 ? "win" : "loss",
        itemName: data.item.name,
      });
      const actor = store.user;
      store.pushDrop({
        kind: "contract",
        userId: actor?.id,
        user: actor?.username,
        avatarHue: actor?.avatarHue,
        caseName: "Contract",
        skin: data.item,
      });
      setSlots(Array(SLOTS).fill(null));
      setExtra(0);
      setHasInk(false);
      setPadReset((n) => n + 1);
      setReward(data.item);
      setProfit(pnl);
      setBusy(false);
      setPhase("reveal");
      store.toast({
        title: pnl >= 0 ? "Contract plus" : "Contract minus",
        detail: data.item.name,
        tone: pnl >= 0 ? "rare" : "warn",
      });
    } catch {
      setBusy(false);
      setPhase("error");
      setError("The contract failed to start.");
      store.toast({ title: "Contract failed to start", tone: "err" });
    }
  }

  function dismissReveal() {
    setReward(null);
    setPhase("idle");
    setError(null);
  }

  const rangeMin = preview?.minReward ?? 0;
  const rangeMax = preview?.maxReward ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-graphite">
        {store.hydrated ? (
          <div className="grid min-w-[36rem] grid-cols-10 divide-x divide-line">
            {slots.map((slot, index) => (
              <ContractSlot
                key={index}
                item={slot}
                index={index}
                required={index < CONTRACT_MIN_ITEMS}
                busy={busy}
                reduceMotion={store.reduceMotion}
                onClear={() => clear(index)}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-w-[36rem] grid-cols-10 divide-x divide-line">
            {Array.from({ length: SLOTS }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-none" />
            ))}
          </div>
        )}
      </div>

      <div className="surface grid items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_auto_1fr] sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {store.user ? (
            <>
              <Wallet className="h-3.5 w-3.5 shrink-0 text-mute" />
              <p className="meta truncate">
                Your balance:{" "}
                <span className="font-semibold text-ink">{store.hydrated ? formatBalance(wallet) : "—"}</span>
              </p>
              <Link
                href="/deposit"
                aria-label="Пополнить баланс"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-[var(--radius-xs)] border border-cyan/35 bg-cyan/10 text-cyan hover:bg-cyan/18"
              >
                <Plus className="h-3 w-3" />
              </Link>
            </>
          ) : null}
        </div>
        <p className="label text-center text-cyan">
          {!store.hydrated
            ? "Loading"
            : busy
              ? "Signing"
              : shortOnBoard
                ? `Put at least ${needed} more ${needed === 1 ? "item" : "items"}`
                : hasInk
                  ? "Ready to sign"
                  : "Sign the pad to confirm"}
        </p>
        <p className="meta sm:text-right">
          Contract sum:{" "}
          {store.hydrated ? <Price amount={contractSum} className="text-[length:var(--type-sm)]" /> : "—"}
        </p>
      </div>

      <div className="contract-desk grid items-stretch gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="surface surface-pad flex h-full min-w-0 flex-col gap-3 self-stretch">
          <SectionHeading
            className="shrink-0"
            title="My items"
            count={store.hydrated ? vaultCount : undefined}
            actions={
              <span className="w-36 shrink-0">
                <SearchInput
                  compact
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  disabled={!store.hydrated || vaultCount === 0}
                />
              </span>
            }
          />

          {!store.hydrated ? (
            <div className="contract-grid">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <SkinCardSkeleton key={i} />
              ))}
            </div>
          ) : vaultCount === 0 ? (
            <div className="contract-well">
              <EmptyState
                compact
                title="You have no items"
                action={
                  <Link href="/cases">
                    <Button variant="ghost" size="sm">
                      Open a case
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : available.length === 0 ? (
            <div className="contract-well">
              <EmptyState
                compact
                title={boardFull ? "Board is full" : "No matching skins"}
                detail={boardFull ? "Clear a slot to swap in another skin." : "Try another search."}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="contract-grid">
                {pageSlice.map((item) => (
                  <SkinCard
                    key={item.instanceId}
                    skin={item}
                    compact
                    disabled={busy || boardFull}
                    onClick={() => put(item)}
                    className="h-full"
                  />
                ))}
              </div>
              <Pager page={pageSafe} pageCount={pages} onPage={setPage} className="mt-2" />
            </div>
          )}
        </section>

        <section className="surface surface-pad flex h-full min-h-[var(--contract-well-min)] min-w-0 flex-col self-stretch">
          {deskOpen ? (
            <div className="flex h-full min-h-0 flex-1 flex-col gap-5">
              {store.user ? (
              <label className={extraCap <= 0 ? "shrink-0 opacity-50" : "shrink-0 opacity-80"}>
                <span className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <CircleDollarSign className="h-3.5 w-3.5 text-mute" />
                    <span className="label">Use balance</span>
                  </span>
                  <span className="tabular text-sm font-semibold text-ink">{formatBalance(extraStake)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={extraCap > 0 ? extraCap : 0}
                  step={0.01}
                  value={extraStake}
                  disabled={busy || extraCap <= 0}
                  aria-label="Extra stake from balance"
                  onChange={(event) => setExtra(Number(event.target.value))}
                  className="h-1.5 w-full accent-cyan"
                />
                <span className="meta mt-1 block">
                  {extraCap > 0 ? "Included in the expected range." : "No balance to add."}
                </span>
              </label>
              ) : null}

              <div className="shrink-0 text-center">
                <p className="label">You will receive an item</p>
                <p className="mt-1.5 font-display text-sm font-bold tracking-wide text-ink">
                  {preview
                    ? `From ${formatMoney(rangeMin)} to ${formatMoney(rangeMax)}`
                    : "Select items to see the range"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="label shrink-0">Goal</span>
                <span className="relative min-w-0 flex-1">
                  <Shuffle className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute" />
                  <SelectField className="w-full pl-8" defaultValue="random" disabled={busy} aria-label="Contract goal">
                    <option value="random">Random</option>
                  </SelectField>
                </span>
                <Tooltip label="One random skin from the pool near your contract sum.">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-mute">
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </Tooltip>
              </div>

              <SignaturePad
                className="min-h-0 flex-1"
                disabled={busy}
                resetKey={padReset}
                onInkChange={setHasInk}
              />

              <Button
                fullWidth
                size="lg"
                className="mt-auto shrink-0"
                loading={busy}
                disabled={!canSign}
                icon={<Handshake className="h-4 w-4" />}
                onClick={() => void run()}
              >
                Sign
              </Button>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-1 flex-col justify-center">
              <ContractResult
                phase={phase}
                preview={preview}
                reward={reward}
                profit={profit}
                error={error}
                reduceMotion={store.reduceMotion}
                onRetry={() => void run()}
                onDismiss={dismissReveal}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
