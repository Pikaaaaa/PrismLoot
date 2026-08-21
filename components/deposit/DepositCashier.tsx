"use client";

import { SignInActions } from "@/components/auth/SignInActions";
import { CoinMark } from "@/components/deposit/CoinMark";
import { DepositAddressCard } from "@/components/deposit/DepositAddressCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatWagerMultiplier } from "@/lib/gift-cards/wager";
import { CURRENCY_META, formatBalance, formatCurrency } from "@/lib/services/prices/currency";
import { useAppStore } from "@/lib/store";
import { cn, formatMoney, timeAgo } from "@/lib/utils";
import { Gift, Ticket } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Network = {
  id: string;
  label: string;
  confirmations: string;
  address: string;
};

type Coin = {
  asset: string;
  ticker: string;
  name: string;
  color: string;
  usdRate: number;
  minUsd: number;
  networks: Network[];
};

type DepositRow = {
  id: string;
  asset: string;
  network: string;
  address: string;
  amountUsd: number;
  amountCrypto: number;
  status: string;
  txNote: string;
  txHash?: string;
  createdAt: string;
};

const PRESETS = [10, 25, 50, 100];

const METHOD_BTN =
  "flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left sm:min-h-0";

function statusTone(status: string): "warn" | "accent" | "danger" | "outline" {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED") return "accent";
  if (status === "REJECTED") return "danger";
  return "outline";
}

function statusLabel(status: string) {
  if (status === "PENDING") return "Pending";
  if (status === "APPROVED") return "Credited";
  if (status === "REJECTED") return "Rejected";
  return status;
}

function depositError(code?: string) {
  if (code === "AUTH_REQUIRED") return "Sign in with Steam to deposit.";
  if (code === "USER_BANNED") return "This account is banned.";
  if (code === "AMOUNT_TOO_LOW") return "Amount is below the minimum.";
  if (code === "INVALID_ASSET") return "Choose a valid asset and network.";
  if (code === "DEPOSIT_UNAVAILABLE") return "Cashier is not available yet. Try again shortly.";
  if (code === "GIFT_CARD_INVALID") return "Gift card code not found.";
  if (code === "GIFT_CARD_USED") return "This gift card was already redeemed.";
  if (code === "GIFT_CARD_EXPIRED") return "This gift card has expired.";
  if (code === "GIFT_CARD_DISABLED") return "This gift card was disabled.";
  if (code === "GIFT_CARD_UNAVAILABLE") return "Could not redeem the gift card.";
  if (code && /^[A-Z][A-Z0-9_]+$/.test(code)) return "Request failed. Try again.";
  return code ?? "Something went wrong.";
}

function GiftMark() {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.65rem] border border-cyan/40 bg-cyan/12 text-cyan"
      aria-hidden
    >
      <Gift className="h-4 w-4" />
    </span>
  );
}

export function DepositCashier() {
  const store = useAppStore();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [banned, setBanned] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState<"gift" | "crypto">("crypto");
  const [asset, setAsset] = useState("USDT");
  const [networkId, setNetworkId] = useState("trc20");
  const [amount, setAmount] = useState("25");
  const [giftCode, setGiftCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [giftSuccess, setGiftSuccess] = useState<{ amountUsd: number; wagerMultiplier: number } | null>(null);
  const [promoDraft, setPromoDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/deposit");
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        banned?: boolean;
        catalog?: Coin[];
        deposits?: DepositRow[];
      };
      if (!res.ok || !json.ok) {
        setCoins([]);
        setRows([]);
        setLoadError(depositError(json.error) || "Could not load deposit catalog.");
        setCatalogLoaded(true);
        return;
      }
      if (!json.catalog?.length) {
        setCoins([]);
        setRows([]);
        setLoadError("Deposit catalog is empty.");
        setCatalogLoaded(true);
        return;
      }
      setLoadError(null);
      setBanned(Boolean(json.banned));
      setCoins(json.catalog);
      setRows(json.deposits ?? []);
      setCatalogLoaded(true);
    } catch {
      setCoins([]);
      setRows([]);
      setLoadError("Could not reach deposit API.");
      setCatalogLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const coin = coins.find((row) => row.asset === asset) ?? coins[0] ?? null;
  const network = useMemo(() => {
    if (!coin) return null;
    return coin.networks.find((row) => row.id === networkId) ?? coin.networks[0] ?? null;
  }, [coin, networkId]);

  useEffect(() => {
    if (!coin) return;
    if (!coin.networks.some((row) => row.id === networkId)) {
      setNetworkId(coin.networks[0]?.id ?? "");
    }
  }, [coin, networkId]);

  const amountUsdt = Number(amount);
  const validAmount = Boolean(coin && Number.isFinite(amountUsdt) && amountUsdt >= coin.minUsd);
  const amountUsd = validAmount ? amountUsdt : 0;
  const displayCurrency = store.displayCurrency;
  const displayMeta = CURRENCY_META[displayCurrency] ?? CURRENCY_META.USD;
  const amountCrypto =
    validAmount && coin && coin.usdRate > 0
      ? +((amountUsdt / coin.usdRate).toFixed(coin.asset === "USDT" || coin.asset === "USDC" ? 2 : 8))
      : null;

  const addressLabel =
    coin?.asset === "BTC"
      ? "BTC address"
      : coin?.asset === "ETH"
        ? "ETH address"
        : coin?.asset === "SOL"
          ? "SOL address"
          : coin?.asset === "TRX"
            ? "TRX address"
            : coin?.asset === "USDC"
              ? "USDC address"
              : coin?.asset === "TON"
                ? "TON address"
                : coin?.asset === "USDT" && network?.id === "trc20"
                ? "USDT address (TRC-20)"
                : `${coin?.ticker ?? "Deposit"} address`;
  const promoPct = store.savedPromo?.match(/-(\d{2})$/)?.[1] ? Number(store.savedPromo.match(/-(\d{2})$/)![1]) : null;
  const promoBonusUsd =
    promoPct && validAmount && Number.isFinite(amountUsdt) ? +((amountUsdt * promoPct) / 100).toFixed(2) : 0;
  const totalWithPromoUsd = validAmount && promoBonusUsd > 0 ? +(amountUsdt + promoBonusUsd).toFixed(2) : null;

  function applyPromo() {
    const code = promoDraft.trim().toUpperCase();
    if (!code) {
      store.toast({ title: "Enter a promo code", detail: "Add a code before applying.", tone: "warn" });
      return;
    }
    void store.savePromo(code).then((ok) => {
      if (ok) setPromoDraft("");
    });
  }

  async function redeemGift() {
    setBusy(true);
    setSubmitError(null);
    setGiftSuccess(null);
    try {
      const res = await fetch("/api/gift-cards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: giftCode }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        amountUsd?: number;
        wagerMultiplier?: number;
        wagerRemainingUsd?: number;
      };
      if (!res.ok || !json.ok) {
        const detail =
          json.message && !/^[A-Z][A-Z0-9_]+$/.test(json.message) ? json.message : depositError(json.error);
        setSubmitError(detail);
        store.toast({ title: "Gift card failed", detail, tone: "err" });
        return;
      }
      const credited = typeof json.amountUsd === "number" ? json.amountUsd : 0;
      const multiplier = typeof json.wagerMultiplier === "number" ? json.wagerMultiplier : 0;
      if (credited > 0) store.credit(credited);
      if (typeof json.wagerRemainingUsd === "number") store.setWagerRemaining(json.wagerRemainingUsd);
      setGiftCode("");
      setGiftSuccess({ amountUsd: credited, wagerMultiplier: multiplier });
      store.toast({
        title: "Gift card redeemed",
        detail: credited
          ? `+${formatMoney(credited)} · wager ${formatWagerMultiplier(multiplier)}`
          : "Balance updated.",
        tone: "ok",
      });
    } catch {
      setSubmitError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!store.hydrated) {
    return (
      <div className="page-stack">
        <PageHeader kicker="Wallet" title="Deposit" />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="surface surface-pad space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <Skeleton className="min-h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!store.user) {
    return (
      <div className="page-stack">
        <PageHeader kicker="Wallet" title="Deposit" />
        <div className="surface surface-pad mx-auto max-w-md text-center">
          <p className="font-semibold text-ink">Sign in with Steam</p>
          <p className="meta mt-1.5">Deposits and gift cards require a Steam account.</p>
          <div className="mt-4 flex justify-center">
            <SignInActions />
          </div>
        </div>
      </div>
    );
  }

  if (!catalogLoaded) {
    return (
      <div className="page-stack">
        <PageHeader kicker="Wallet" title="Deposit" />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="surface surface-pad space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <Skeleton className="min-h-80 w-full" />
        </div>
      </div>
    );
  }

  if (loadError && coins.length === 0) {
    return (
      <div className="page-stack">
        <PageHeader kicker="Wallet" title="Deposit" />
        <ErrorState title="Cashier failed to load" detail={loadError} action={<Button onClick={() => void load()}>Retry</Button>} />
      </div>
    );
  }

  return (
    <div className="page-stack min-w-0">
      <PageHeader
        kicker="Wallet"
        title="Deposit"
        description="Crypto or PrismLoot gift cards. Skins are withdrawn from inventory."
        actions={
          <div className="w-full min-w-0 text-left sm:w-auto sm:text-right">
            <p className="label">Balance</p>
            <p className="price text-[length:var(--type-h2)]">{formatBalance(store.balance, displayCurrency)}</p>
            {store.wagerRemainingUsd > 0 ? (
              <p className="meta mt-1">Wager {formatMoney(store.wagerRemainingUsd)}</p>
            ) : null}
          </div>
        }
      />

      {banned ? (
        <ErrorState title="Account banned" detail="Cases, upgrades, contracts, and deposits are disabled." />
      ) : null}

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section className="surface surface-pad min-w-0">
          <p className="label mb-2">1. Method</p>
          <div className="max-h-[min(52vh,26rem)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] lg:max-h-none lg:overflow-visible">
            <div className="flex flex-col gap-1.5 pr-0.5">
              <button
                type="button"
                onClick={() => {
                  setMethod("gift");
                  setSubmitError(null);
                }}
                className={cn(
                  METHOD_BTN,
                  method === "gift" ? "border-cyan/35 bg-cyan/10" : "border-line bg-graphite hover:border-line-strong",
                )}
              >
                <GiftMark />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Gift card</span>
                  <span className="meta">PrismLoot · instant</span>
                </span>
              </button>
              {coins.map((row) => {
                const on = method === "crypto" && row.asset === coin?.asset;
                return (
                  <button
                    key={row.asset}
                    type="button"
                    onClick={() => {
                      setMethod("crypto");
                      setAsset(row.asset);
                      setSubmitError(null);
                    }}
                    className={cn(
                      METHOD_BTN,
                      on ? "border-cyan/35 bg-cyan/10" : "border-line bg-graphite hover:border-line-strong",
                    )}
                  >
                    <CoinMark ticker={row.ticker} color={row.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{row.ticker}</span>
                      <span className="meta">{row.name}</span>
                    </span>
                    <span className="meta hidden shrink-0 sm:inline">{row.networks.map((n) => n.label).join(" · ")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="surface surface-pad flex min-w-0 flex-col gap-5">
          {method === "gift" ? (
            <>
              <div>
                <p className="label mb-2">2. Card code</p>
                <p className="mb-3 text-sm leading-relaxed text-soft">
                  Enter a code like <span className="font-mono text-ink">PL-XXXX-XXXX-XXXX</span>. Balance is credited instantly.
                </p>
                <label>
                  <span className="label">PrismLoot gift card</span>
                  <input
                    className="field mt-1 font-mono uppercase tracking-wider"
                    value={giftCode}
                    onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                    placeholder="PL-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </div>
              {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
              {giftSuccess ? (
                <p className="text-sm text-cyan">
                  +{formatMoney(giftSuccess.amountUsd)} credited · wager {formatWagerMultiplier(giftSuccess.wagerMultiplier)}
                  {store.wagerRemainingUsd > 0 ? ` · ${formatMoney(store.wagerRemainingUsd)} left` : ""}
                </p>
              ) : null}
              <Button
                size="lg"
                fullWidth
                loading={busy}
                disabled={banned || giftCode.trim().length < 8}
                icon={<Gift className="h-4 w-4" />}
                onClick={() => void redeemGift()}
              >
                Redeem
              </Button>
              <p className="meta text-center">One code · one deposit. Cards are issued by the operator.</p>
            </>
          ) : !coin || !network ? (
            <EmptyState compact title="No assets available" />
          ) : (
            <>
              <div>
                <p className="label mb-2">2. Choose a chain</p>
                <div className="flex flex-wrap gap-2">
                  {coin.networks.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setNetworkId(row.id)}
                      className={cn(
                        "min-h-10 rounded-full border px-3.5 text-xs font-semibold sm:min-h-8 sm:px-3",
                        row.id === network.id
                          ? "border-cyan/30 bg-cyan/12 text-cyan"
                          : "border-line bg-white/[0.03] text-mute hover:text-ink",
                      )}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
                <p className="meta mt-2">{network.confirmations}</p>
              </div>

              <div>
                <p className="label mb-2">3. Confirm deposit details</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((n) => (
                    <Button key={n} size="sm" variant={amount === String(n) ? "primary" : "ghost"} onClick={() => setAmount(String(n))}>
                      {displayCurrency === "USD" ? formatCurrency(n, "USD") : formatBalance(n, displayCurrency)}
                    </Button>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="label">Amount</span>
                  {displayCurrency !== "USD" ? (
                    <span className="meta ml-2">
                      USD · ≈ {displayMeta.symbol} in {displayMeta.label}
                    </span>
                  ) : null}
                  <input
                    className="field mt-1 tabular"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    aria-label={displayCurrency === "USD" ? "Deposit amount in USD" : `Deposit amount in USD (shown as ${displayCurrency})`}
                  />
                </label>
                {validAmount ? (
                  <div className="mt-2 space-y-1 rounded-[var(--radius-sm)] border border-line bg-graphite px-3 py-2.5">
                    {displayCurrency !== "USD" ? (
                      <p className="text-sm text-soft">
                        ≈ <span className="font-semibold text-ink">{formatBalance(amountUsd, displayCurrency)}</span>
                      </p>
                    ) : null}
                    <p className="meta tabular">{formatCurrency(amountUsd, "USD")} USD</p>
                    {amountCrypto != null ? (
                      <p className="text-sm font-semibold text-cyan tabular">
                        ≈ {amountCrypto} {coin.ticker}
                      </p>
                    ) : null}
                    {totalWithPromoUsd ? (
                      <p className="text-sm text-soft">
                        With promo:{" "}
                        <span className="font-semibold text-ink">
                          {displayCurrency === "USD"
                            ? formatCurrency(totalWithPromoUsd, "USD")
                            : formatBalance(totalWithPromoUsd, displayCurrency)}
                        </span>{" "}
                        credited
                        {promoBonusUsd > 0 ? (
                          <span className="meta">
                            {" "}
                            (+{displayCurrency === "USD" ? formatCurrency(promoBonusUsd, "USD") : formatBalance(promoBonusUsd, displayCurrency)}{" "}
                            bonus)
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="meta mt-1.5">
                    Minimum{" "}
                    {displayCurrency === "USD" ? formatCurrency(coin.minUsd, "USD") : formatBalance(coin.minUsd, displayCurrency)}
                  </p>
                )}

                <div className="mt-3">
                  <span className="label">Promo code</span>
                  <div className="mt-1 flex min-w-0 gap-2">
                    <input
                      value={promoDraft}
                      onChange={(e) => setPromoDraft(e.target.value.toUpperCase())}
                      placeholder="Promo code"
                      aria-label="Deposit promo code"
                      className="field min-w-0 flex-1 uppercase"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Button
                      size="sm"
                      className="min-h-10 shrink-0 sm:min-h-8"
                      icon={<Ticket className="h-3.5 w-3.5" />}
                      onClick={applyPromo}
                    >
                      Apply
                    </Button>
                  </div>
                  {store.savedPromo ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone="gold">{store.savedPromo}</Badge>
                      <span className="meta">
                        {promoPct ? `+${promoPct}% bonus` : "deposit bonus"}
                        {totalWithPromoUsd
                          ? ` · total ${
                              displayCurrency === "USD"
                                ? formatCurrency(totalWithPromoUsd, "USD")
                                : formatBalance(totalWithPromoUsd, displayCurrency)
                            }`
                          : ""}
                      </span>
                    </div>
                  ) : (
                    <p className="meta mt-1.5">Optional deposit bonus</p>
                  )}
                </div>
              </div>

              <DepositAddressCard label={addressLabel} address={network.address} showStepHeader={false} />
            </>
          )}
        </section>
      </div>

      <section className="surface overflow-x-auto">
        <div className="surface-pad">
          <h2>History</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState compact title="No deposits yet" detail="Completed deposits appear here." />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-graphite text-xs uppercase text-mute">
              <tr>
                <th className="p-3">When</th>
                <th>Asset</th>
                <th>USD</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="p-3 meta">{timeAgo(Date.parse(row.createdAt))}</td>
                  <td className="font-semibold">
                    {row.asset}
                    <span className="meta"> · {row.network}</span>
                  </td>
                  <td className="tabular">{formatMoney(row.amountUsd)}</td>
                  <td>
                    <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
