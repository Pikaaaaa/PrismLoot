"use client";

import { SteamSignInButton } from "@/components/auth/SteamButton";
import { CoinMark } from "@/components/deposit/CoinMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { publicDepositCatalog } from "@/lib/deposits/catalog";
import { formatWagerMultiplier } from "@/lib/gift-cards/wager";
import { useAppStore } from "@/lib/store";
import { cn, formatBalance, formatMoney, timeAgo } from "@/lib/utils";
import { Check, Copy, Gift, Wallet } from "lucide-react";
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
  createdAt: string;
};

const PRESETS = [10, 25, 50, 100];
const STATIC_CATALOG = publicDepositCatalog() as Coin[];

function statusTone(status: string): "warn" | "accent" | "danger" | "outline" {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED") return "accent";
  if (status === "REJECTED") return "danger";
  return "outline";
}

function statusLabel(status: string) {
  if (status === "PENDING") return "Ожидает";
  if (status === "APPROVED") return "Зачислено";
  if (status === "REJECTED") return "Отклонено";
  return status;
}

function playErrorRu(code?: string) {
  if (code === "AUTH_REQUIRED") return "Войдите через Steam, чтобы пополнить баланс.";
  if (code === "USER_BANNED") return "Аккаунт заблокирован. Пополнение недоступно.";
  if (code === "AMOUNT_TOO_LOW") return "Сумма ниже минимума для этой монеты.";
  if (code === "INVALID_ASSET") return "Выберите монету и сеть.";
  if (code === "DEPOSIT_UNAVAILABLE") return "Касса ещё поднимается. Повторите через секунду.";
  if (code === "GIFT_CARD_INVALID") return "Код не найден или указан неверно.";
  if (code === "GIFT_CARD_USED") return "Эта карта уже использована.";
  if (code === "GIFT_CARD_EXPIRED") return "Срок действия карты истёк.";
  if (code === "GIFT_CARD_DISABLED") return "Карта отключена оператором.";
  if (code === "GIFT_CARD_UNAVAILABLE") return "Не удалось активировать карту. Повторите попытку.";
  if (code && /^[A-Z][A-Z0-9_]+$/.test(code)) return "Не удалось выполнить запрос. Повторите попытку.";
  return code ?? "Не удалось создать заявку.";
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
  const [coins, setCoins] = useState<Coin[]>(STATIC_CATALOG);
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [banned, setBanned] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState<"gift" | "crypto">("crypto");
  const [asset, setAsset] = useState("USDT");
  const [networkId, setNetworkId] = useState("trc20");
  const [amount, setAmount] = useState("25");
  const [txNote, setTxNote] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [giftSuccess, setGiftSuccess] = useState<{ amountUsd: number; wagerMultiplier: number } | null>(null);

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
        setCoins(STATIC_CATALOG);
        setRows([]);
        setLoadError(null);
        return;
      }
      setLoadError(null);
      setBanned(Boolean(json.banned));
      setCoins(json.catalog?.length ? json.catalog : STATIC_CATALOG);
      setRows(json.deposits ?? []);
    } catch {
      setCoins(STATIC_CATALOG);
      setRows([]);
      setLoadError(null);
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

  const amountUsd = Number(amount);
  const validAmount = Boolean(coin && Number.isFinite(amountUsd) && amountUsd >= coin.minUsd);
  const crypto = coin && validAmount ? amountUsd / coin.usdRate : 0;
  const cryptoLabel =
    crypto >= 1 ? crypto.toFixed(4) : crypto > 0 ? crypto.toFixed(8) : "—";

  async function copyAddress() {
    if (!network?.address) return;
    try {
      await navigator.clipboard.writeText(network.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      store.toast({ title: "Не удалось скопировать", tone: "warn" });
    }
  }

  async function submit() {
    if (!coin || !network || !validAmount) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: coin.asset,
          network: network.id,
          amountUsd,
          txNote,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSubmitError(playErrorRu(json.error));
        store.toast({ title: "Заявка не создана", detail: playErrorRu(json.error), tone: "err" });
        return;
      }
      setTxNote("");
      store.toast({
        title: "Заявка отправлена",
        detail: "Баланс зачислится после подтверждения админом.",
        tone: "ok",
      });
      await load();
    } catch {
      setSubmitError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
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
        balance?: number;
        wagerMultiplier?: number;
        wagerRemainingUsd?: number;
      };
      if (!res.ok || !json.ok) {
        const detail =
          json.message && !/^[A-Z][A-Z0-9_]+$/.test(json.message)
            ? json.message
            : playErrorRu(json.error);
        setSubmitError(detail);
        store.toast({ title: "Карта не активирована", detail, tone: "err" });
        return;
      }
      const credited = typeof json.amountUsd === "number" ? json.amountUsd : 0;
      const multiplier = typeof json.wagerMultiplier === "number" ? json.wagerMultiplier : 0;
      if (credited > 0) store.credit(credited);
      if (typeof json.wagerRemainingUsd === "number") store.setWagerRemaining(json.wagerRemainingUsd);
      setGiftCode("");
      setGiftSuccess({ amountUsd: credited, wagerMultiplier: multiplier });
      store.toast({
        title: "Карта активирована",
        detail: credited
          ? `+${formatMoney(credited)} · отыгровка ${formatWagerMultiplier(multiplier)}`
          : "Баланс обновлён.",
        tone: "ok",
      });
    } catch {
      setSubmitError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  if (!store.hydrated) {
    return (
      <div className="page-stack">
        <PageHeader kicker="Кошелёк" title="Пополнение" />
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
        <PageHeader kicker="Кошелёк" title="Пополнение" />
        <div className="surface surface-pad mx-auto max-w-md text-center">
          <p className="font-semibold text-ink">Sign in with Steam</p>
          <p className="meta mt-1.5">Deposits and gift cards need a Steam account.</p>
          <div className="mt-4 flex justify-center">
            <SteamSignInButton />
          </div>
        </div>
      </div>
    );
  }

  if (loadError && coins.length === 0) {
    return (
      <div className="page-stack">
        <PageHeader kicker="Кошелёк" title="Пополнение" />
        <ErrorState title="Касса не загрузилась" detail={loadError} action={<Button onClick={() => void load()}>Повторить</Button>} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Кошелёк"
        title="Пополнение"
        description="Крипта или подарочная карта PrismLoot. По крипте баланс появится после подтверждения админом. Скины выводятся из инвентаря."
        actions={
          <div className="text-right">
            <p className="label">Баланс</p>
            <p className="price text-[length:var(--type-h2)]">{formatBalance(store.balance)}</p>
            {store.wagerRemainingUsd > 0 ? (
              <p className="meta mt-1">Отыгровка {formatMoney(store.wagerRemainingUsd)}</p>
            ) : null}
          </div>
        }
      />

      {banned ? (
        <ErrorState title="Аккаунт заблокирован" detail="Открывать кейсы, апгрейды, контракты и пополнения нельзя." />
      ) : null}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section className="surface surface-pad">
          <p className="label mb-2">1. Способ</p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMethod("gift");
                setSubmitError(null);
              }}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left",
                method === "gift" ? "border-cyan/35 bg-cyan/10" : "border-line bg-graphite hover:border-line-strong",
              )}
            >
              <GiftMark />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Подарочная карта</span>
                <span className="meta">PrismLoot · мгновенно</span>
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
                    "flex items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left",
                    on ? "border-cyan/35 bg-cyan/10" : "border-line bg-graphite hover:border-line-strong",
                  )}
                >
                  <CoinMark ticker={row.ticker} color={row.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{row.ticker}</span>
                    <span className="meta">{row.name}</span>
                  </span>
                  <span className="meta">{row.networks.map((n) => n.label).join(" · ")}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="surface surface-pad flex min-w-0 flex-col gap-5">
          {method === "gift" ? (
            <>
              <div>
                <p className="label mb-2">2. Код карты</p>
                <p className="mb-3 text-sm leading-relaxed text-soft">
                  Введите код вида <span className="font-mono text-ink">PL-XXXX-XXXX-XXXX</span>. Баланс зачисляется сразу.
                </p>
                <label>
                  <span className="label">Подарочная карта PrismLoot</span>
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
                  +{formatMoney(giftSuccess.amountUsd)} на баланс · отыгровка{" "}
                  {formatWagerMultiplier(giftSuccess.wagerMultiplier)}
                  {store.wagerRemainingUsd > 0 ? ` · осталось ${formatMoney(store.wagerRemainingUsd)}` : ""}
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
                Активировать
              </Button>
              <p className="meta text-center">Один код — одно пополнение. Карты выпускает админ.</p>
            </>
          ) : !coin || !network ? (
            <EmptyState compact title="Нет доступных монет" />
          ) : (
            <>
              <div>
                <p className="label mb-2">2. Сеть</p>
                <div className="flex flex-wrap gap-2">
                  {coin.networks.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setNetworkId(row.id)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-semibold",
                        row.id === network.id
                          ? "border-cyan/30 bg-cyan/12 text-cyan"
                          : "border-line bg-white/[0.03] text-mute hover:text-ink",
                      )}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
                <p className="meta mt-2">Подтверждения: {network.confirmations}</p>
              </div>

              <div>
                <p className="label mb-2">3. Сумма и адрес</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((n) => (
                    <Button key={n} size="sm" variant={amount === String(n) ? "primary" : "ghost"} onClick={() => setAmount(String(n))}>
                      ${n}
                    </Button>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="label">Сумма, USD</span>
                  <input
                    className="field mt-1 tabular"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <p className="meta mt-1.5">
                  Минимум {formatMoney(coin.minUsd)} · к оплате {cryptoLabel} {coin.ticker}
                </p>
              </div>

              <div className="rounded-[var(--radius-md)] border border-line bg-graphite p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="label">Адрес пополнения ({network.label})</p>
                    <p className="mt-1 break-all font-mono text-sm text-ink">{network.address}</p>
                  </div>
                  <Button size="sm" variant="ghost" icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => void copyAddress()}>
                    {copied ? "Ок" : "Copy"}
                  </Button>
                </div>
              </div>

              <label>
                <span className="label">Tx / memo (необязательно)</span>
                <input
                  className="field mt-1"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="Хеш или заметка для админа"
                />
              </label>

              {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

              <Button
                size="lg"
                fullWidth
                loading={busy}
                disabled={banned || !validAmount}
                icon={<Wallet className="h-4 w-4" />}
                onClick={() => void submit()}
              >
                Я оплатил
              </Button>
              <p className="meta text-center">Заявка уходит админу. Баланс зачислится после подтверждения.</p>
            </>
          )}
        </section>
      </div>

      <section className="surface overflow-x-auto">
        <div className="surface-pad">
          <h2>Заявки</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState compact title="Пока пусто" detail="Создайте заявку справа — она появится здесь и у админа." />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-graphite text-xs uppercase text-mute">
              <tr>
                <th className="p-3">Когда</th>
                <th>Актив</th>
                <th>USD</th>
                <th>Статус</th>
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
