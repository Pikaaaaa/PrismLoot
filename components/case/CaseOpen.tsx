"use client";

import { SteamSignInButton } from "@/components/auth/SteamButton";
import { CaseOpeningShow, IdleReel, JackpotFX } from "@/components/case/CaseOpeningShow";
import { CaseRewardGrid, type RewardRow } from "@/components/case/CaseRewardGrid";
import { readCaseOpenPrefs, writeCaseOpenPrefs, type CaseOpenPrefs } from "@/components/case/caseOpenPrefs";
import { unlockReelAudio } from "@/components/case/caseReelAudio";
import { RarityPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/EmptyState";
import { FilterChip } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Price } from "@/components/ui/Price";
import { Skeleton, SkinGridSkeleton } from "@/components/ui/Skeleton";
import { CaseBackground, CaseVisual } from "@/components/visuals/CaseVisual";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { isJuicedHit, spinDurationMs } from "@/lib/case-reveal";
import { SELL_COEFFICIENT, TOP_DROP_THRESHOLD } from "@/lib/economy/config";
import { SKIN_MAP } from "@/lib/mock-data";
import { clearPendingOpens, readPendingOpens, writePendingOpens } from "@/lib/pending";
import { RARITY_DESC, RARITY_META, WEAR_META } from "@/lib/rarity";
import { getSkinPrice, priceUpdatedLabel, sellValueUsd } from "@/lib/services/prices/priceProvider";
import { canSellDrop, ownedDrops } from "@/lib/inventoryOwnership";
import { useAppStore } from "@/lib/store";
import type { Crate, InventoryItem } from "@/lib/types";
import { formatDropChance, formatMoney } from "@/lib/utils";
import { FastForward, Volume2, VolumeX, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const COUNTS = [1, 2, 3, 5] as const;
type OpenCount = (typeof COUNTS)[number];
type Phase = "idle" | "opening" | "spin" | "reveal";

const DEFAULT_PREFS: CaseOpenPrefs = { skip: false, fast: false, sound: false };

function sectionLabel(section: string) {
  return section.replace(/-/g, " ");
}

export function CaseOpen({ crate }: { crate: Crate }) {
  const router = useRouter();
  const store = useAppStore();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pending, setPending] = useState<InventoryItem[]>([]);
  const [chances, setChances] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [count, setCount] = useState<OpenCount>(1);
  const [openError, setOpenError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<CaseOpenPrefs>(DEFAULT_PREFS);
  const restored = useRef(false);
  const revealTimer = useRef(0);
  const feedTimer = useRef(0);

  const loot: RewardRow[] = useMemo(
    () =>
      crate.rewards
        .map((row) => {
          const skin = SKIN_MAP[row.skinId];
          if (!skin || row.chance <= 0) return null;
          return {
            skinId: row.skinId,
            chance: row.chance,
            rarity: row.rarity,
            skin,
            price: getSkinPrice(row.skinId).price,
          } satisfies RewardRow;
        })
        .filter((row): row is RewardRow => row != null),
    [crate, store.priceTick],
  );
  const featured = SKIN_MAP[crate.featuredReward];
  const pool = useMemo(() => loot.map((row) => row.skin), [loot]);
  const featRow = loot.find((row) => row.skinId === crate.featuredReward);
  const quote = featured ? getSkinPrice(featured.id) : null;
  const charge = +(crate.price * count).toFixed(2);
  const compact = pending.length > 1;
  const durationMs = spinDurationMs({
    skip: prefs.skip,
    fast: prefs.fast,
    reduceMotion: store.reduceMotion,
  });
  const busy = phase === "opening" || phase === "spin";

  useEffect(() => {
    setPrefs(readCaseOpenPrefs());
  }, []);

  useEffect(() => {
    if (!store.hydrated || !store.sessionReady || restored.current) return;
    restored.current = true;
    if (!store.user) {
      clearPendingOpens();
      return;
    }
    const row = readPendingOpens();
    if (!row || row.caseId !== crate.id || !row.items.length) return;
    // applyOpen already granted once. Pending is animation UI only — never re-claim.
    setCount((COUNTS.find((n) => n === row.count) ?? 1) as OpenCount);
    setPending(row.items);
    const elapsed = Date.now() - row.startedAt;
    const spinMs = row.spinMs || 0;
    if (row.phase === "reveal" || elapsed >= spinMs || spinMs <= 0) {
      finishReveal(row.items, true);
      return;
    }
    setPhase("spin");
    setPlaying(true);
    revealTimer.current = window.setTimeout(() => finishReveal(row.items, false), Math.max(80, spinMs - elapsed));
  }, [store.hydrated, store.sessionReady, store.user, crate.id]);

  useEffect(() => {
    return () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      if (feedTimer.current) window.clearTimeout(feedTimer.current);
    };
  }, []);

  function updatePrefs(patch: Partial<CaseOpenPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeCaseOpenPrefs(next);
      return next;
    });
  }

  function publishFeed(items: InventoryItem[]) {
    if (!store.user) return;
    for (const item of items) {
      const market = getSkinPrice(item.id, item.wear).price ?? 0;
      store.pushDrop({
        kind: "case",
        action: market >= TOP_DROP_THRESHOLD ? "TOP_DROP" : "CASE_OPEN",
        userId: store.user.id,
        user: store.user.username,
        avatarHue: store.user.avatarHue,
        caseId: crate.id,
        caseName: crate.name,
        skin: item,
        skinId: item.id,
      });
    }
  }

  function finishReveal(items: InventoryItem[], skippedSpin: boolean) {
    setPlaying(false);
    setPhase("reveal");
    writePendingOpens({
      caseId: crate.id,
      count: items.length,
      charge: crate.price * items.length,
      items,
      startedAt: Date.now(),
      spinMs: 0,
      phase: "reveal",
    });
    if (!skippedSpin) {
      if (feedTimer.current) window.clearTimeout(feedTimer.current);
      feedTimer.current = window.setTimeout(() => publishFeed(items), 800);
    }
    const juiced = items.some((item) => isJuicedHit(crate.price, getSkinPrice(item.id, item.wear).price));
    store.toast({
      title: items.length > 1 ? `Opened ×${items.length}` : "Case opened",
      detail: items.map((item) => item.name).join(" · "),
      tone: juiced ? "rare" : "ok",
    });
  }

  async function open(n = count) {
    if (phase !== "idle") return;
    if (!store.user) {
      store.beginSteamLogin();
      return;
    }
    const total = +(crate.price * n).toFixed(2);
    if (store.balance < total) {
      store.toast({ title: "Not enough balance", tone: "err" });
      return;
    }
    setOpenError(null);
    setPhase("opening");
    if (prefs.sound) unlockReelAudio();
    try {
      const res = await fetch("/api/cases/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: crate.id, count: n }),
      });
      const data = (await res.json()) as { ok: boolean; items?: InventoryItem[]; item?: InventoryItem; error?: string };
      const items = data.items?.length ? data.items : data.item ? [data.item] : [];
      if (!data.ok || !items.length) {
        const detail = data.error ?? "The open request did not return a roll.";
        setPhase("idle");
        setOpenError(detail);
        store.toast({ title: "Open failed", detail, tone: "err" });
        return;
      }
      const allowed = new Set(crate.rewards.filter((row) => row.chance > 0).map((row) => row.skinId));
      if (items.some((item) => !allowed.has(item.id))) {
        setPhase("idle");
        setOpenError("Rolled skin is not in this case");
        store.toast({ title: "Open failed", detail: "Rolled skin is not in this case", tone: "err" });
        return;
      }
      if (!store.applyOpen(total, items)) {
        setPhase("idle");
        setOpenError("Balance could not be charged.");
        return;
      }
      const spinMs = spinDurationMs({
        skip: prefs.skip,
        fast: prefs.fast,
        reduceMotion: store.reduceMotion,
      });
      writePendingOpens({
        caseId: crate.id,
        count: n,
        charge: total,
        items,
        startedAt: Date.now(),
        spinMs,
        phase: spinMs <= 0 ? "reveal" : "spin",
      });
      setPending(items);
      store.addHistory({
        kind: "open",
        title: n > 1 ? `Opened ${crate.name} ×${n}` : `Opened ${crate.name}`,
        detail: items.map((item) => item.name).join(", "),
        amount: -total,
        itemName: items[0]?.name,
      });
      if (spinMs <= 0) {
        finishReveal(items, true);
        return;
      }
      setPhase("spin");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setPlaying(true));
      });
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(() => finishReveal(items, false), spinMs);
    } catch {
      setPhase("idle");
      setPlaying(false);
      setOpenError("Network error. Your balance was not charged.");
      store.toast({ title: "Network error", tone: "err" });
    }
  }

  function skipNow() {
    if (phase !== "spin" || !pending.length) return;
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    finishReveal(pending, true);
  }

  function sellNow(item: InventoryItem) {
    if (!canSellDrop(item.instanceId, store.inventory)) {
      store.toast({ title: "Item no longer in inventory", tone: "warn" });
      return false;
    }
    const value = sellValueUsd(item.id, SELL_COEFFICIENT, item.wear);
    if (value == null) {
      store.toast({ title: "Price unavailable", detail: "Cannot sell without a market quote.", tone: "err" });
      return false;
    }
    store.removeItems([item.instanceId], { [item.instanceId]: value });
    store.credit(value);
    store.addHistory({ kind: "sell", title: "Sold item", detail: item.name, amount: value });
    store.toast({ title: "Sold", detail: `${item.name} · ${formatMoney(value)}`, tone: "ok" });
    return true;
  }

  function keep() {
    const stillOwned = ownedDrops(pending, store.inventory);
    reset();
    if (stillOwned.length) {
      store.toast({
        title: stillOwned.length > 1 ? "Added to inventory" : `${stillOwned[0]!.name} added to inventory`,
        tone: "ok",
      });
    }
  }

  function sellAllPending() {
    const left = ownedDrops(pending, store.inventory);
    let sold = 0;
    for (const item of left) {
      if (sellNow(item)) sold += 1;
    }
    if (sold > 0) reset();
  }

  function sellPending() {
    if (pending.length === 1) {
      if (sellNow(pending[0]!)) reset();
      return;
    }
    sellAllPending();
  }

  function openAnother() {
    reset();
    window.setTimeout(() => void open(count), 40);
  }

  function reset() {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    if (feedTimer.current) window.clearTimeout(feedTimer.current);
    clearPendingOpens();
    setPhase("idle");
    setPlaying(false);
    setPending([]);
  }

  const juicedItems = pending.filter((item) => isJuicedHit(crate.price, getSkinPrice(item.id, item.wear).price));
  const ownedPending = ownedDrops(pending, store.inventory);
  const sellTotal = ownedPending.reduce((sum, item) => {
    const value = sellValueUsd(item.id, SELL_COEFFICIENT, item.wear);
    return value == null ? sum : sum + value;
  }, 0);
  const stillOwned = ownedPending.length > 0;
  const canSell = ownedPending.some((item) => sellValueUsd(item.id, SELL_COEFFICIENT, item.wear) != null);

  if (!store.hydrated) return <CaseDetailSkeleton />;

  return (
    <div className="page-stack">
      <section className="surface relative overflow-hidden">
        <CaseBackground crate={crate} />
        <div className="relative surface-pad grid gap-6 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-center lg:gap-8">
          <div className="relative mx-auto bg-transparent">
            <CaseVisual crate={crate} size="hero" />
          </div>
          <div className="min-w-0">
            <p className="label">{sectionLabel(crate.section)}</p>
            <h1 className="mt-1">{crate.name}</h1>
            <p className="mt-2 max-w-xl text-sm text-soft">{crate.description}</p>
            <p className="price mt-4 text-[length:var(--type-h1)]">{formatMoney(crate.price)}</p>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {COUNTS.map((n) => (
                <FilterChip key={n} active={count === n} disabled={busy} onClick={() => setCount(n)}>
                  ×{n}
                </FilterChip>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {store.user ? (
                <Button size="xl" loading={busy} onClick={() => void open(count)}>
                  {busy ? "Opening…" : count > 1 ? `Open ×${count} · ${formatMoney(charge)}` : "Open"}
                </Button>
              ) : store.sessionReady ? (
                <SteamSignInButton size="lg" />
              ) : (
                <Button size="xl" loading disabled>
                  Open
                </Button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <FilterChip active={prefs.skip} onClick={() => updatePrefs({ skip: !prefs.skip })}>
                Skip animation
              </FilterChip>
              <FilterChip active={prefs.fast} disabled={prefs.skip} onClick={() => updatePrefs({ fast: !prefs.fast })}>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Fast
                </span>
              </FilterChip>
              <FilterChip
                active={prefs.sound}
                onClick={() => {
                  if (!prefs.sound) unlockReelAudio();
                  updatePrefs({ sound: !prefs.sound });
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {prefs.sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  Sound
                </span>
              </FilterChip>
            </div>
          </div>
        </div>

        <div className="relative grid gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5">
          {featured && quote ? (
            <div className="surface-inset flex min-w-0 items-center gap-3 p-3">
              <SkinVisual
                skin={featured}
                framed={false}
                showWear={false}
                pad={8}
                className="h-20 w-36 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-graphite"
              />
              <div className="min-w-0">
                <p className="label">Featured drop</p>
                <p className="mt-0.5 truncate font-semibold">{featured.name}</p>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                  <RarityPill rarity={featured.rarity} />
                  <Price quote={quote} />
                  {featRow ? <span className="meta tabular">{formatDropChance(featRow.chance)}</span> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="surface-inset p-3">
              <p className="label">Featured drop</p>
              <p className="mt-1 text-sm text-mute">No headline item on this crate.</p>
            </div>
          )}

          <div className="surface-inset flex min-w-0 flex-col justify-center gap-2 p-3">
            <p className="label">Quick facts</p>
            <p className="text-sm text-soft">
              <span className="tabular font-semibold text-ink">{loot.length}</span> items in this crate
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button type="button" className="text-sm font-semibold text-cyan hover:underline" onClick={() => setChances(true)}>
                Odds
              </button>
              <Link href="/fairness" className="text-sm text-mute hover:text-ink">
                Fairness
              </Link>
            </div>
          </div>
        </div>
      </section>

      {openError ? (
        <ErrorState
          title="Open failed"
          detail={openError}
          action={
            <Button size="sm" variant="ghost" onClick={() => void open(count)}>
              Try again
            </Button>
          }
        />
      ) : null}

      <div className="relative">
        {phase === "spin" && !prefs.skip && !store.reduceMotion ? (
          <div className="mb-2 flex justify-end">
            <Button size="xs" variant="ghost" icon={<FastForward className="h-3.5 w-3.5" />} onClick={skipNow}>
              Skip
            </Button>
          </div>
        ) : null}
        <div className="case-reel-well">
          {pending.length && (phase === "spin" || phase === "reveal") ? (
            compact ? (
              <div
                className="grid h-full min-h-0 gap-1 p-1"
                style={{ gridTemplateColumns: `repeat(${pending.length}, minmax(0, 1fr))` }}
              >
                {pending.map((item, index) => (
                  <CaseOpeningShow
                    key={item.instanceId}
                    pool={pool}
                    winner={item}
                    playing={playing}
                    reduceMotion={store.reduceMotion}
                    settled={phase === "reveal"}
                    compact
                    durationMs={durationMs}
                    sound={prefs.sound && index === 0}
                  />
                ))}
              </div>
            ) : (
              <CaseOpeningShow
                key={pending[0]!.instanceId}
                pool={pool}
                winner={pending[0]!}
                playing={playing}
                reduceMotion={store.reduceMotion}
                settled={phase === "reveal"}
                durationMs={durationMs}
                sound={prefs.sound}
              />
            )
          ) : pool.length ? (
            <IdleReel pool={pool} reduceMotion={store.reduceMotion} />
          ) : (
            <IdleReel pool={[]} />
          )}
        </div>
      </div>

      <CaseRewardGrid loot={loot} />

      <Modal
        open={chances}
        onClose={() => setChances(false)}
        title="Drop chances"
        description="Odds are identical for every player."
        size="xl"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {RARITY_DESC.map((rarity) => {
            const pct = crate.rarityDistribution[rarity];
            if (pct == null || pct <= 0) return null;
            const meta = RARITY_META[rarity];
            return (
              <div key={rarity} className="surface-inset flex items-center justify-between px-3 py-2">
                <RarityPill rarity={rarity} />
                <span className="tabular text-sm font-semibold" style={{ color: meta.color }}>
                  {formatDropChance(pct)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 max-h-[50vh] space-y-1.5 overflow-auto pr-1">
          {loot.map((row) => (
            <div key={row.skinId} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line px-2 py-2">
              <SkinVisual skin={row.skin} framed={false} showWear={false} pad={0} className="h-12 w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.skin.name}</p>
                <p className="meta truncate">{row.skin.weapon}</p>
              </div>
              <Price quote={getSkinPrice(row.skinId)} className="text-sm" />
              <span className="tabular w-20 shrink-0 text-right text-sm" style={{ color: RARITY_META[row.rarity].color }}>
                {formatDropChance(row.chance)}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      <ResultModal
        open={phase === "reveal" && pending.length > 0}
        items={pending}
        juiced={juicedItems.length > 0}
        stillOwned={stillOwned}
        canSell={canSell}
        sellLabel={
          ownedPending.length === 1
            ? sellValueUsd(ownedPending[0]!.id, SELL_COEFFICIENT, ownedPending[0]!.wear) != null
              ? `Sell · ${formatMoney(sellValueUsd(ownedPending[0]!.id, SELL_COEFFICIENT, ownedPending[0]!.wear)!)}`
              : "Sell"
            : sellTotal > 0
              ? `Sell all · ${formatMoney(sellTotal)}`
              : "Sell all"
        }
        onKeep={keep}
        onSell={sellPending}
        onOpenAnother={openAnother}
        onUpgrade={
          pending.length === 1 && canSellDrop(pending[0]?.instanceId, store.inventory)
            ? () => {
                const id = pending[0]!.instanceId;
                keep();
                router.push(`/upgrade?from=${id}`);
              }
            : undefined
        }
      />
    </div>
  );
}

function ResultModal({
  open,
  items,
  juiced,
  stillOwned,
  canSell,
  sellLabel,
  onKeep,
  onSell,
  onOpenAnother,
  onUpgrade,
}: {
  open: boolean;
  items: InventoryItem[];
  juiced: boolean;
  stillOwned: boolean;
  canSell: boolean;
  sellLabel: string;
  onKeep: () => void;
  onSell: () => void;
  onOpenAnother: () => void;
  onUpgrade?: () => void;
}) {
  const lead = items[0];
  return (
    <Modal
      open={open}
      onClose={onKeep}
      title={juiced ? "Jackpot" : items.length > 1 ? `Opened ×${items.length}` : "Opened"}
      description={juiced ? "A high-multiple hit on this crate." : undefined}
      size={items.length > 1 ? "lg" : "md"}
      footer={
        <div className="flex flex-col gap-2">
          <div className={stillOwned ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
            <Button variant="gold" onClick={onKeep} fullWidth>
              Keep
            </Button>
            {stillOwned ? (
              <Button variant="ghost" onClick={onSell} disabled={!canSell} fullWidth>
                {sellLabel}
              </Button>
            ) : null}
          </div>
          <Button onClick={onOpenAnother} fullWidth>
            Open another
          </Button>
          {onUpgrade ? (
            <Button variant="quiet" onClick={onUpgrade} fullWidth>
              Use in Upgrade
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="relative text-center">
        {juiced ? <JackpotFX /> : null}
        {items.length === 1 && lead ? (
          <SingleResult item={lead} />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.instanceId} className="min-w-0">
                <SkinVisual
                  skin={item}
                  framed={false}
                  showWear={false}
                  pad={4}
                  className="mx-auto h-20 w-full rounded-[var(--radius-sm)] bg-graphite"
                />
                <p className="mt-1 truncate text-xs font-semibold">{item.name}</p>
                <p className="meta truncate">{WEAR_META[item.wear].short}</p>
                <Price quote={getSkinPrice(item.id, item.wear)} className="text-sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SingleResult({ item }: { item: InventoryItem }) {
  const quote = getSkinPrice(item.id, item.wear);
  return (
    <>
      <SkinVisual
        skin={item}
        framed={false}
        featured
        showWear={false}
        pad={8}
        className="mx-auto h-44 max-w-md rounded-[var(--radius-md)] bg-graphite"
      />
      <h3 className="mt-3">{item.name}</h3>
      <p className="meta">{WEAR_META[item.wear].label}</p>
      <div className="mt-2 flex justify-center gap-2">
        <RarityPill rarity={item.rarity} />
        <Price quote={quote} />
      </div>
      <p className="meta mt-1">{priceUpdatedLabel(quote)}</p>
    </>
  );
}

function CaseDetailSkeleton() {
  return (
    <div className="page-stack">
      <div className="surface surface-pad grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Skeleton className="mx-auto h-64 w-64 rounded-[var(--radius-xl)]" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-11 w-48" />
        </div>
      </div>
      <Skeleton className="h-[11.5rem] w-full rounded-[var(--radius-md)]" />
      <SkinGridSkeleton count={12} />
    </div>
  );
}
