"use client";

import type { ItemActionId } from "@/components/inventory/ItemActions";
import { SkinWithdrawSend } from "@/components/inventory/SkinWithdrawSend";
import { SkinCard } from "@/components/skin/SkinCard";
import { Badge, RarityPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip, FilterRow, SearchInput, SelectField } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Pager } from "@/components/ui/Pager";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SkinGridSkeleton } from "@/components/ui/Skeleton";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { looksLikeTradeUrl } from "@/lib/auth/account";
import { isStickerItem } from "@/lib/itemCatalog";
import { SELL_COEFFICIENT } from "@/lib/economy/config";
import { RARITY_DESC, RARITY_META, WEAR_META, rarityRank } from "@/lib/rarity";
import { convertPrice } from "@/lib/services/prices/currency";
import { formatQuotePrice, getSkinPrice, sellValueUsd } from "@/lib/services/prices/priceProvider";
import { isInVault, isWithdrawPending, vaultStatusLabel } from "@/lib/inventoryOwnership";
import { useAppStore } from "@/lib/store";
import type { InventoryItem, Rarity } from "@/lib/types";
import { cn, formatBalance, formatMoney } from "@/lib/utils";
import { PackageOpen, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, type ReactNode } from "react";

type SortId = "new" | "old" | "price-desc" | "price-asc" | "rarity" | "name";
type VaultFilter = "all" | "vault" | "sold" | "used" | "withdrawn" | "error" | "pending";

const PAGE_SIZE = 20;
const SORTS: Array<{ id: SortId; label: string }> = [
  { id: "new", label: "Newest first" },
  { id: "old", label: "Oldest first" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "rarity", label: "Rarity" },
  { id: "name", label: "Name A–Z" },
];

const CARD_ACTIONS: ItemActionId[] = ["sell", "upgrade", "contract", "withdraw", "details"];
const PENDING_LOCKED_ACTIONS: ItemActionId[] = ["sell", "upgrade", "contract", "withdraw"];
const HISTORY_ACTIONS: ItemActionId[] = ["details"];

type SellRow = { item: InventoryItem; value: number };

type PendingWithdraw = {
  id: string;
  status: string;
  kind?: string;
  itemName?: string;
  amountUsd: number;
  createdAt: string;
  inventoryItemId?: string | null;
};

function withdrawErrorMessage(code?: string, message?: string) {
  if (code === "TRADE_URL_REQUIRED" || code === "TRADE_URL_INVALID") {
    return "Add your trade URL in profile.";
  }
  if (message && !/^[A-Z][A-Z0-9_]+$/.test(message)) return message;
  if (code === "USER_BANNED") return "This account is banned. Withdrawals are disabled.";
  if (code === "WAGER_LOCKED") return "Play through the remaining amount in cases, upgrades, or contracts first.";
  if (code === "ITEMS_UNAVAILABLE") return "That skin is no longer in your inventory.";
  if (code === "WITHDRAWAL_PENDING") return "This skin is already on its way to Steam.";
  if (code === "WITHDRAWAL_UNAVAILABLE") return "Could not create a withdrawal request. Refresh the page and try again.";
  if (code && /^[A-Z][A-Z0-9_]+$/.test(code)) return "Could not complete the request. Try again.";
  return "Could not create the request.";
}

/** Only skins with a live market quote can be sold — never invent a price. */
function pricedRows(list: InventoryItem[]): SellRow[] {
  const rows: SellRow[] = [];
  for (const item of list) {
    if (!isInVault(item)) continue;
    const value = sellValueUsd(item.id, SELL_COEFFICIENT, item.wear, item.stickers);
    if (value != null) rows.push({ item, value });
  }
  return rows;
}

/**
 * @param compact Embedded variant for the profile dashboard: the account row is
 * dropped because the page above it already shows avatar, balance and stats.
 */
export function InventoryVault({
  compact = false,
  variant = "default",
}: {
  compact?: boolean;
  variant?: "default" | "profile";
}) {
  const store = useAppStore();
  const router = useRouter();
  const profileLayout = variant === "profile";

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortId>("new");
  const [dropFilter, setDropFilter] = useState<VaultFilter>("all");
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [confirmSell, setConfirmSell] = useState<InventoryItem | null>(null);
  const [sellAllOpen, setSellAllOpen] = useState(false);
  const [details, setDetails] = useState<InventoryItem | null>(null);
  const [sending, setSending] = useState<InventoryItem | null>(null);
  const [tradeNeeded, setTradeNeeded] = useState(false);
  const [page, setPage] = useState(0);

  const min = Number.parseFloat(minPrice);
  const max = Number.parseFloat(maxPrice);
  const filtersActive = q !== "" || rarities.length > 0 || Number.isFinite(min) || Number.isFinite(max);

  const liveCount = useMemo(() => store.inventory.filter(isInVault).length, [store.inventory]);
  const soldCount = useMemo(
    () => store.inventory.filter((item) => item.leftVia === "sell").length,
    [store.inventory],
  );
  const usedCount = useMemo(
    () => store.inventory.filter((item) => item.leftVia === "upgrade" || item.leftVia === "contract").length,
    [store.inventory],
  );
  const withdrawnCount = useMemo(
    () => store.inventory.filter((item) => item.leftVia === "withdraw" && !isWithdrawPending(item)).length,
    [store.inventory],
  );
  const pendingCount = useMemo(
    () => store.inventory.filter((item) => isWithdrawPending(item)).length,
    [store.inventory],
  );

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = store.inventory.filter((item) => {
      if (dropFilter === "vault" && !isInVault(item)) return false;
      if (dropFilter === "sold" && item.leftVia !== "sell") return false;
      if (dropFilter === "used" && item.leftVia !== "upgrade" && item.leftVia !== "contract") return false;
      if (dropFilter === "withdrawn" && (item.leftVia !== "withdraw" || isWithdrawPending(item))) return false;
      if (dropFilter === "pending" && !isWithdrawPending(item)) return false;
      if (dropFilter === "error") return false;
      if (
        needle &&
        !item.name.toLowerCase().includes(needle) &&
        !item.weapon.toLowerCase().includes(needle) &&
        !(item.collection ?? "").toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (rarities.length && !rarities.includes(item.rarity)) return false;
      if (Number.isFinite(min) || Number.isFinite(max)) {
        const quote = getSkinPrice(item.id, item.wear);
        if (quote.price == null) return false;
        const shown = convertPrice(quote.price);
        if (Number.isFinite(min) && shown < min) return false;
        if (Number.isFinite(max) && shown > max) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const pa = getSkinPrice(a.id, a.wear).price ?? 0;
      const pb = getSkinPrice(b.id, b.wear).price ?? 0;
      switch (sort) {
        case "old":
          return a.obtainedAt - b.obtainedAt;
        case "price-desc":
          return pb - pa;
        case "price-asc":
          return pa - pb;
        case "rarity":
          return rarityRank(b.rarity) - rarityRank(a.rarity) || pb - pa;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return b.obtainedAt - a.obtainedAt;
      }
    });
    // Quotes are read through a module cache, so a price tick has to re-run this.
  }, [
    q,
    rarities,
    sort,
    min,
    max,
    dropFilter,
    store.inventory,
    store.priceTick,
    store.displayCurrency,
  ]);

  useEffect(() => {
    setPage(0);
  }, [dropFilter, q, sort, rarities, minPrice, maxPrice]);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pagedItems = items.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const sellableShown = useMemo(() => pricedRows(items), [items, store.priceTick]);
  const shownTotal = sellableShown.reduce((sum, row) => sum + row.value, 0);

  const best = useMemo(() => {
    let winner: { item: InventoryItem; price: number } | null = null;
    for (const item of store.inventory) {
      if (!isInVault(item)) continue;
      const quote = getSkinPrice(item.id, item.wear);
      if (!quote.available || quote.price == null) continue;
      if (!winner || quote.price > winner.price) winner = { item, price: quote.price };
    }
    return winner;
  }, [store.inventory, store.priceTick]);

  function toggleRarity(rarity: Rarity) {
    setRarities((current) =>
      current.includes(rarity) ? current.filter((row) => row !== rarity) : [...current, rarity],
    );
  }

  function resetFilters() {
    setQ("");
    setRarities([]);
    setMinPrice("");
    setMaxPrice("");
    setDropFilter("all");
  }

  function sellRows(rows: SellRow[], label: string) {
    if (!rows.length) {
      store.toast({ title: "Nothing to sell", detail: "No market quote on these skins.", tone: "warn" });
      return;
    }
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const ids = rows.map((row) => row.item.instanceId);
    const sales = Object.fromEntries(rows.map((row) => [row.item.instanceId, row.value]));
    store.removeItems(ids, sales);
    store.credit(total);
    store.addHistory({
      kind: "sell",
      title: rows.length > 1 ? "Sold items" : "Sold item",
      detail: rows.length > 1 ? `${rows.length} skins` : rows[0]!.item.name,
      amount: total,
    });
    store.toast({ title: "Sold", detail: `${label} · ${formatMoney(total)}`, tone: "ok" });
  }

  function sellOne(item: InventoryItem) {
    if (isWithdrawPending(item)) return;
    const value = sellValueUsd(item.id, SELL_COEFFICIENT, item.wear, item.stickers);
    if (value == null) {
      store.toast({ title: "Price unavailable", detail: "Cannot sell without a market quote.", tone: "err" });
      return;
    }
    sellRows([{ item, value }], item.name);
    setConfirmSell(null);
    setDetails(null);
  }

  function goUpgrade(list: InventoryItem[]) {
    const priced = [...list]
      .filter((item) => isInVault(item))
      .sort((a, b) => (getSkinPrice(b.id, b.wear).price ?? 0) - (getSkinPrice(a.id, a.wear).price ?? 0));
    const lead = priced[0];
    if (!lead) return;
    if (priced.length > 1) {
      store.toast({
        title: "Upgrade opened with your top pick",
        detail: `${lead.name} is staked — add the rest from the upgrade vault.`,
        tone: "warn",
      });
    }
    router.push(`/upgrade?from=${lead.instanceId}`);
  }

  function missingTradeUrl() {
    setSending(null);
    setTradeNeeded(true);
    store.toast({
      title: "Add your trade URL in profile",
      detail: "Withdrawals cannot be created without it.",
      tone: "err",
      href: "/profile#trade",
      hrefLabel: "Open profile",
    });
  }

  async function requestWithdraw(item: InventoryItem) {
    if (sending) return;
    if (isWithdrawPending(item)) return;
    if (!store.user) {
      store.toast({ title: "Sign in required", detail: "Sign in to submit a withdrawal request.", tone: "warn" });
      return;
    }
    if (!looksLikeTradeUrl(store.tradeUrl)) {
      missingTradeUrl();
      return;
    }
    if (store.wagerRemainingUsd > 0) {
      store.toast({
        title: "Play through your deposit first",
        detail: `Play through ${formatMoney(store.wagerRemainingUsd)} in cases, upgrades, or contracts.`,
        tone: "warn",
      });
      return;
    }

    setSending(item);
    const started = Date.now();
    const minMs = store.reduceMotion ? 280 : 1100;
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: item.instanceId, tradeUrl: store.tradeUrl }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        withdrawal?: PendingWithdraw;
      };
      const wait = Math.max(0, minMs - (Date.now() - started));
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
      if (!res.ok || !json.ok) {
        if (json.error === "TRADE_URL_REQUIRED" || json.error === "TRADE_URL_INVALID") {
          missingTradeUrl();
          return;
        }
        console.error("[withdraw] request failed", json.error, json.message);
        store.toast({ title: "Request not created", detail: withdrawErrorMessage(json.error, json.message), tone: "err" });
        return;
      }
      store.markWithdrawPending(item.instanceId);
      setDetails(null);
      store.addHistory({
        kind: "withdraw",
        title: "Skin withdrawal",
        detail: item.name,
        amount: 0,
        itemName: item.name,
      });
      store.toast({
        title: "On the way",
        detail: "Your skin will arrive in Steam soon.",
        tone: "ok",
      });
    } catch {
      const wait = Math.max(0, minMs - (Date.now() - started));
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
      store.toast({ title: "Network unavailable", tone: "err" });
    } finally {
      setSending(null);
    }
  }

  function onCardAction(id: ItemActionId, item: InventoryItem) {
    if (!isInVault(item) && id !== "details") return;
    if (id === "sell") setConfirmSell(item);
    if (id === "upgrade") goUpgrade([item]);
    if (id === "contract") {
      if (isStickerItem(item)) return;
      router.push("/contracts");
    }
    if (id === "withdraw") void requestWithdraw(item);
    if (id === "details") setDetails(item);
  }

  const confirmValue = confirmSell ? sellValueUsd(confirmSell.id, SELL_COEFFICIENT, confirmSell.wear, confirmSell.stickers) : null;
  const detailsQuote = details ? getSkinPrice(details.id, details.wear) : null;
  const detailsSell = details ? sellValueUsd(details.id, SELL_COEFFICIENT, details.wear, details.stickers) : null;
  const detailsPending = details ? isWithdrawPending(details) : false;
  const detailsLive = details ? isInVault(details) : false;
  const detailsStatus = details ? vaultStatusLabel(details) : null;

  return (
    <section className="section-stack">
      {compact || !store.user ? null : (
        <header className="surface surface-pad flex flex-wrap items-center gap-x-5 gap-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar name={store.user.username} hue={store.user.avatarHue} src={store.user.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{store.user.username}</p>
              <p className="meta">Balance {formatBalance(store.balance)}</p>
              {store.wagerRemainingUsd > 0 ? (
                <p className="meta">Playthrough {formatMoney(store.wagerRemainingUsd)}</p>
              ) : null}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 items-stretch gap-3 sm:grid-cols-3">
            <VaultStat label="Items" value={liveCount.toLocaleString()} />
            <VaultStat label="Vault value" value={formatMoney(store.inventoryValue)} />
            <VaultStat
              label="Best item"
              value={best ? formatMoney(best.price) : "—"}
              detail={best?.item.name ?? "No priced drops yet"}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </header>
      )}

      {profileLayout ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-center font-display text-[length:var(--type-h2)] tracking-[0.12em]">YOUR ITEMS</h2>
          <div className="flex flex-wrap items-center gap-2">
            <VaultStatusChips
              dropFilter={dropFilter}
              onChange={setDropFilter}
              counts={{ liveCount, soldCount, usedCount, withdrawnCount, pendingCount }}
            />
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                disabled={sellableShown.length === 0}
                onClick={() => setSellAllOpen(true)}
              >
                {sellableShown.length === 0 ? "No items for sale" : `Sell all · ${formatMoney(shownTotal)}`}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
      <SectionHeading
        title="Vault"
        count={liveCount}
        description={
          items.length === store.inventory.length
            ? "Every drop stays listed. Sold and used skins keep their place with a status."
            : `${items.length} of ${store.inventory.length} shown`
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={sellableShown.length === 0}
            onClick={() => setSellAllOpen(true)}
          >
            {sellableShown.length === 0 ? "Nothing to sell" : `Sell shown · ${formatMoney(shownTotal)}`}
          </Button>
        }
      />

      <div className="surface surface-pad flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skins" />
          <SelectField value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Sort items">
            {SORTS.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </SelectField>
          <div className="flex items-center gap-1.5">
            <span className="label shrink-0">Price</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              aria-label="Minimum price"
              className="field tabular w-20"
            />
            <span className="text-mute">–</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              aria-label="Maximum price"
              className="field tabular w-20"
            />
          </div>
          {filtersActive ? (
            <Button variant="quiet" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={resetFilters}>
              Reset
            </Button>
          ) : null}
        </div>

        <FilterRow>
          <VaultStatusChips
            dropFilter={dropFilter}
            onChange={setDropFilter}
            counts={{ liveCount, soldCount, usedCount, withdrawnCount, pendingCount }}
          />
        </FilterRow>

        <FilterRow>
          <FilterChip active={rarities.length === 0} onClick={() => setRarities([])}>
            All rarities
          </FilterChip>
          {RARITY_DESC.map((rarity) => (
            <FilterChip
              key={rarity}
              active={rarities.includes(rarity)}
              onClick={() => toggleRarity(rarity)}
              style={
                rarities.includes(rarity)
                  ? {
                      color: RARITY_META[rarity].color,
                      borderColor: `${RARITY_META[rarity].color}55`,
                      background: `${RARITY_META[rarity].color}14`,
                    }
                  : undefined
              }
            >
              {RARITY_META[rarity].label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>
        </>
      )}

      {!store.hydrated ? (
        <SkinGridSkeleton count={10} />
      ) : store.inventory.length === 0 ? (
        <EmptyState
          icon={<PackageOpen />}
          title={profileLayout ? "No items yet" : "Your vault is empty"}
          detail={profileLayout ? "Open a case — every drop lands here." : "Open a case — every drop lands here instantly."}
          action={
            <Button size="sm" onClick={() => router.push("/cases")}>
              Open a case
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No skins match these filters"
          detail="Loosen the price range or clear the rarity chips."
          action={
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="vault-grid">
          {pagedItems.map((item) => {
            const pending = isWithdrawPending(item);
            const live = isInVault(item);
            const status = vaultStatusLabel(item);
            return (
              <SkinCard
                key={item.instanceId}
                skin={item}
                vault
                pending={pending}
                muted={!live && !pending}
                statusLabel={status}
                actions
                actionIds={live || pending ? CARD_ACTIONS : HISTORY_ACTIONS}
                actionDisabledIds={
                  pending
                    ? PENDING_LOCKED_ACTIONS
                    : isStickerItem(item)
                      ? ["contract"]
                      : undefined
                }
                onAction={(id) => onCardAction(id, item)}
              />
            );
          })}
        </div>
      )}

      {store.hydrated && items.length > PAGE_SIZE ? (
        <Pager page={pageSafe} pageCount={pageCount} onPage={setPage} />
      ) : null}

      <Modal
        open={!!confirmSell}
        onClose={() => setConfirmSell(null)}
        title="Sell item?"
        size="sm"
        footer={
          <div className="flex w-full min-w-0 flex-wrap gap-2">
            <Button variant="ghost" className="min-w-0 flex-1" onClick={() => setConfirmSell(null)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              className="min-w-0 flex-1"
              disabled={confirmValue == null}
              onClick={() => confirmSell && sellOne(confirmSell)}
            >
              Confirm sell
            </Button>
          </div>
        }
      >
        <p className="text-[length:var(--type-sm)] text-soft">
          Instant sale of <strong className="text-ink">{confirmSell?.name}</strong>{" "}
          {confirmValue != null ? `for ${formatMoney(confirmValue)}.` : "is unavailable — no market price."}
        </p>
      </Modal>

      <Modal
        open={sellAllOpen}
        onClose={() => setSellAllOpen(false)}
        title="Sell everything shown?"
        size="sm"
        footer={
          <div className="flex w-full min-w-0 flex-wrap gap-2">
            <Button variant="ghost" className="min-w-0 flex-1" onClick={() => setSellAllOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              className="min-w-0 flex-1"
              disabled={sellableShown.length === 0}
              onClick={() => {
                sellRows(sellableShown, `${sellableShown.length} skins`);
                setSellAllOpen(false);
              }}
            >
              Confirm sell
            </Button>
          </div>
        }
      >
        <p className="text-[length:var(--type-sm)] text-soft">
          {sellableShown.length === 0
            ? "Nothing with a market quote to sell."
            : `Sell ${sellableShown.length} skins currently shown for ${formatMoney(shownTotal)}.`}
        </p>
      </Modal>

      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title={details?.name}
        description={
          details
            ? `${isStickerItem(details) ? "N/A" : WEAR_META[details.wear].label} · ${details.collection ?? "Collection"}`
            : undefined
        }
        size="md"
        footer={
          detailsLive ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="gold"
              size="sm"
              disabled={detailsSell == null || detailsPending}
              onClick={() => details && sellOne(details)}
            >
              {detailsSell != null ? `Sell · ${formatMoney(detailsSell)}` : "Sell unavailable"}
            </Button>
            <Button variant="ghost" size="sm" disabled={detailsPending} onClick={() => details && goUpgrade([details])}>
              Use in Upgrade
            </Button>
            <Button variant="ghost" size="sm" disabled={detailsPending || (details != null && isStickerItem(details))} onClick={() => router.push("/contracts")}>
              Use in Contract
            </Button>
            <Button variant="quiet" size="sm" disabled={detailsPending} onClick={() => details && void requestWithdraw(details)}>
              Withdraw
            </Button>
          </div>
          ) : detailsPending ? (
            <Badge tone="warn">On the way</Badge>
          ) : detailsStatus ? (
            <Badge tone="accent">{detailsStatus}</Badge>
          ) : null
        }
      >
        {details ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="surface-inset relative h-40 w-full overflow-hidden sm:w-56">
              <SkinVisual skin={details} framed={false} chrome={false} showWear={false} pad={16} className="h-full w-full" />
            </div>
            <dl className="min-w-0 flex-1 space-y-2.5">
              <DetailRow label="Rarity">
                <RarityPill rarity={details.rarity} />
              </DetailRow>
              <DetailRow label="Exterior">{isStickerItem(details) ? "N/A" : WEAR_META[details.wear].label}</DetailRow>
              <DetailRow label="StatTrak">
                {isStickerItem(details) ? (
                  <span className="text-mute">N/A</span>
                ) : details.stattrak ? (
                  <Badge tone="warn">StatTrak™</Badge>
                ) : (
                  <span className="text-mute">No</span>
                )}
              </DetailRow>
              <DetailRow label="Status">
                {detailsPending ? (
                  <Badge tone="warn">On the way</Badge>
                ) : detailsStatus ? (
                  <Badge tone="accent">{detailsStatus}</Badge>
                ) : (
                  <Badge tone="accent">In vault</Badge>
                )}
              </DetailRow>
              <DetailRow label="Market price">
                <span className="price">{detailsQuote ? formatQuotePrice(detailsQuote) : "—"}</span>
              </DetailRow>
              <DetailRow label="Quote source">{detailsQuote?.sourceLabel ?? "—"}</DetailRow>
            </dl>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={tradeNeeded}
        onClose={() => setTradeNeeded(false)}
        title="Trade URL required"
        size="sm"
        footer={
          <div className="flex w-full min-w-0 flex-wrap gap-2">
            <Button variant="ghost" className="min-w-0 flex-1" onClick={() => setTradeNeeded(false)}>
              Close
            </Button>
            <Button
              className="min-w-0 flex-1"
              onClick={() => {
                setTradeNeeded(false);
                router.push("/profile#trade");
              }}
            >
              Open profile
            </Button>
          </div>
        }
      >
        <p className="text-[length:var(--type-sm)] text-soft">
          Add your trade URL in profile. Withdrawals cannot be created without it.
        </p>
        <p className="meta mt-2">
          Format:{" "}
          <span className="break-all text-soft">https://steamcommunity.com/tradeoffer/new/?partner=…</span>
        </p>
        <p className="mt-2">
          <Link href="/profile#trade" className="text-sm font-semibold text-cyan hover:brightness-110">
            Go to profile
          </Link>
        </p>
      </Modal>

      {sending ? <SkinWithdrawSend item={sending} /> : null}
    </section>
  );
}

function VaultStatusChips({
  dropFilter,
  onChange,
  counts,
}: {
  dropFilter: VaultFilter;
  onChange: (id: VaultFilter) => void;
  counts: {
    liveCount: number;
    soldCount: number;
    usedCount: number;
    withdrawnCount: number;
    pendingCount: number;
  };
}) {
  const chips: Array<{ id: VaultFilter; label: string }> = [
    { id: "all", label: "All drop" },
    { id: "vault", label: `In vault (${counts.liveCount})` },
    { id: "sold", label: `Sold (${counts.soldCount})` },
    { id: "used", label: `Used (${counts.usedCount})` },
    { id: "withdrawn", label: `Withdrawn (${counts.withdrawnCount})` },
    { id: "pending", label: `In process (${counts.pendingCount})` },
    { id: "error", label: "Error (0)" },
  ];
  return (
    <>
      {chips.map((chip) => (
        <FilterChip key={chip.id} active={dropFilter === chip.id} onClick={() => onChange(chip.id)}>
          {chip.label}
        </FilterChip>
      ))}
    </>
  );
}

function splitStatMoney(value: string) {
  const prefix = value.match(/^(-?)([₽$€₴])\s*(.*)$/u);
  if (prefix && prefix[3]) {
    return { symbol: `${prefix[1]}${prefix[2]}`, amount: prefix[3], symbolAfter: false };
  }
  const suffix = value.match(/^(-?.+?)\s+(zł)$/u);
  if (suffix) {
    return { symbol: suffix[2], amount: suffix[1], symbolAfter: true };
  }
  return { symbol: null as string | null, amount: value, symbolAfter: false };
}

function VaultStat({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  const money = splitStatMoney(value);
  return (
    <div className={cn("vault-stat surface-inset", className)}>
      <p className="label">{label}</p>
      <p className="vault-stat-value">
        {money.symbol && !money.symbolAfter ? <span className="vault-stat-symbol">{money.symbol}</span> : null}
        <span className="vault-stat-amount">{money.amount}</span>
        {money.symbol && money.symbolAfter ? <span className="vault-stat-symbol">{money.symbol}</span> : null}
      </p>
      {detail ? <p className="meta truncate">{detail}</p> : null}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
      <dt className="label">{label}</dt>
      <dd className="min-w-0 truncate text-[length:var(--type-sm)] text-soft">{children}</dd>
    </div>
  );
}
