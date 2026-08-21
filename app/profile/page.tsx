"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { InventoryVault } from "@/components/inventory/InventoryVault";
import { DEMO_PROMO_CODE } from "@/components/layout/PromoBanner";
import { memberSinceLabel } from "@/components/profile/activity";
import { deriveLevel } from "@/components/profile/level";
import { Badge, RarityPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CaseVisual } from "@/components/visuals/CaseVisual";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { looksLikeTradeUrl } from "@/lib/auth/account";
import { bestDropStatusLabel, skinFromBestDrop } from "@/lib/bestDrop";
import { isStickerItem } from "@/lib/itemCatalog";
import { CASES } from "@/lib/mock-data";
import { RARITY_META, WEAR_META } from "@/lib/rarity";
import { useAppStore } from "@/lib/store";
import type { CurrencyCode, HistoryEntry } from "@/lib/types";
import { DISPLAY_CURRENCIES } from "@/lib/ui/catalog";
import { cn, formatBalance, formatMoney, timeAgo } from "@/lib/utils";
import {
  ArrowLeftRight,
  Box,
  Check,
  Coins,
  HelpCircle,
  History,
  LogOut,
  Plus,
  Scroll,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

/**
 * Editable field that mirrors a store value: the draft resets when the store
 * changes (hydration, another tab) but stays untouched while you type.
 */
function useSyncedDraft(source: string) {
  const [draft, setDraft] = useState(source);
  const [synced, setSynced] = useState(source);
  if (synced !== source) {
    setSynced(source);
    setDraft(source);
  }
  return [draft, setDraft] as const;
}

function promoBonusLabel(code: string | null) {
  if (!code) return null;
  const match = code.match(/-(\d+)$/);
  return match ? `+${match[1]}%` : "bonus";
}

function ProfileFieldCard({
  title,
  value,
  onChange,
  placeholder,
  ariaLabel,
  uppercase,
  inputType,
  autoComplete,
  spellCheck,
  buttonLoading,
  onSubmit,
  notes,
  verified,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  uppercase?: boolean;
  inputType?: "text" | "email";
  autoComplete?: string;
  spellCheck?: boolean;
  buttonLoading?: boolean;
  onSubmit: () => void;
  notes: string[];
  verified?: boolean;
}) {
  return (
    <section className="surface flex min-h-0 flex-1 flex-col px-4 py-3">
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-x-2 gap-y-2">
        <h2 className="min-w-0 truncate text-[length:var(--type-sm)] font-semibold leading-none">{title}</h2>
        <div className="flex h-7 items-center justify-end">
          {verified ? <Check className="h-4 w-4 text-cyan" /> : null}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          type={inputType}
          className={cn("field h-9 min-w-0 w-full text-left", uppercase && "uppercase")}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
        />
        <Button
          size="sm"
          className="h-9 w-full min-w-0"
          icon={<Check className="h-3.5 w-3.5" />}
          loading={buttonLoading}
          onClick={onSubmit}
        >
          Apply
        </Button>
      </div>
      <ul className="mt-2 space-y-0.5">
        {notes.map((note) => (
          <li key={note} className="text-[length:var(--type-micro)] leading-snug text-mute">
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<EmptyState title="Loading profile…" />}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const params = useSearchParams();
  const router = useRouter();
  const store = useAppStore();
  const {
    user,
    stats,
    inventory,
    inventoryValue,
    balance,
    history,
    logout,
    liveFeedOn,
    reduceMotion,
    displayCurrency,
    setSetting,
    setCurrency,
    toast,
    tradeUrl,
    setTradeUrl,
    accountEmail,
    setAccountEmail,
    savedPromo,
    savePromo,
    savedCasePromo,
    saveCasePromo,
    addFreeCaseClaim,
    freeCaseClaims,
    steam,
    beginSteamLogin,
    wagerRemainingUsd,
    joinedAt,
  } = store;

  const panel = params.get("tab");
  const historyOpen = panel === "activity";
  const settingsOpen = panel === "account";

  const [guideOpen, setGuideOpen] = useState(false);
  const [tradeDraft, setTradeDraft] = useSyncedDraft(tradeUrl);
  const [emailDraft, setEmailDraft] = useSyncedDraft(accountEmail);
  const [promoDraft, setPromoDraft] = useSyncedDraft(savedPromo ?? "");
  const [casePromoDraft, setCasePromoDraft] = useSyncedDraft(savedCasePromo ?? "");
  const [casePromoBusy, setCasePromoBusy] = useState(false);
  const [promoBusy, setPromoBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  const level = useMemo(() => deriveLevel(stats, inventoryValue), [stats, inventoryValue]);
  const memberSince = useMemo(
    () => memberSinceLabel(history, inventory, joinedAt),
    [history, inventory, joinedAt],
  );

  const bestDrop = stats.bestDrop;
  const bestDropSkin = useMemo(() => (bestDrop ? skinFromBestDrop(bestDrop) : null), [bestDrop]);
  const bestDropStatus = useMemo(
    () => (bestDrop ? bestDropStatusLabel(bestDrop, inventory) : null),
    [bestDrop, inventory],
  );
  const withdrawn = useMemo(() => {
    const rows = history.filter((entry) => entry.kind === "withdraw");
    return {
      count: rows.length,
      value: rows.reduce((sum, row) => sum + Math.max(0, row.amount), 0),
    };
  }, [history]);
  const freeCaseOpens = useMemo(
    () => freeCaseClaims.reduce((sum, claim) => sum + claim.remaining, 0),
    [freeCaseClaims],
  );
  const readyFreeCase = freeCaseClaims[0] ?? null;

  function closePanel() {
    router.replace("/profile");
  }

  function saveTradeUrl() {
    const next = tradeDraft.trim();
    if (next && !looksLikeTradeUrl(next)) {
      toast({
        title: "Doesn't look like a trade URL",
        detail: "Format check only — nothing is sent to Steam.",
        tone: "warn",
      });
      return;
    }
    setTradeUrl(next);
    toast({
      title: next ? "Trade URL saved" : "Trade URL cleared",
      detail: next ? "Нужна, чтобы вывести скин из инвентаря." : "Вывод скинов будет недоступен, пока ссылка пустая.",
      tone: "ok",
    });
  }

  if (!user) {
    return (
      <div className="page-stack">
        <div className="surface surface-pad mx-auto max-w-md text-center">
          <h1>Sign in</h1>
          <p className="mt-2 text-[length:var(--type-sm)] text-mute">
            Sign in with Steam to keep your balance and inventory. We never ask for a Steam password.
          </p>
          <div className="mt-4 text-left">
            <LoginForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <section id="trade" className="surface shrink-0 px-4 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-x-2 gap-y-2">
              <h2 className="min-w-0 truncate text-[length:var(--type-sm)] font-semibold leading-none">Trade URL</h2>
              <div className="flex h-7 items-center justify-end gap-1">
                {looksLikeTradeUrl(tradeUrl) ? <Check className="h-4 w-4 text-cyan" /> : null}
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-[var(--radius-xs)] text-mute transition-colors hover:bg-white/[0.06] hover:text-ink"
                  aria-label="How to find a trade URL"
                  onClick={() => setGuideOpen(true)}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
              <input
                value={tradeDraft}
                onChange={(e) => setTradeDraft(e.target.value)}
                placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…"
                aria-label="Trade URL"
                className="field h-9 min-w-0 w-full text-left"
              />
              <Button size="sm" className="h-9 w-full min-w-0" onClick={saveTradeUrl}>
                Update
              </Button>
            </div>
            <ul className="mt-2 space-y-0.5">
              <li className="text-[length:var(--type-micro)] leading-snug text-mute">
                {looksLikeTradeUrl(tradeUrl) ? "Saved. Needed to withdraw skins." : "Paste a Steam trade offer URL."}
              </li>
              <li className="text-[length:var(--type-micro)] leading-snug text-mute">
                Skins go to this offer. PrismLoot does not send cash.
              </li>
            </ul>
          </section>

          <section className="surface flex min-h-0 flex-1 flex-col px-4 py-3">
            <h2 className="text-[length:var(--type-sm)] font-semibold leading-none">Account stats</h2>
            <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2">
              <div className="surface-inset flex items-center gap-2 px-3 py-2">
                <Box className="h-4 w-4 shrink-0 text-cyan" />
                <div className="min-w-0">
                  <p className="price truncate text-[length:var(--type-h3)] leading-none text-cyan">
                    {stats.openedCases.toLocaleString()}
                  </p>
                  <p className="label mt-1">Cases</p>
                </div>
              </div>
              <div className="surface-inset flex items-center gap-2 px-3 py-2">
                <ArrowLeftRight className="h-4 w-4 shrink-0 text-cyan" />
                <div className="min-w-0">
                  <p className="price truncate text-[length:var(--type-h3)] leading-none text-cyan">
                    {stats.upgrades.toLocaleString()}
                  </p>
                  <p className="label mt-1">Upgrades</p>
                </div>
              </div>
              <div className="surface-inset flex items-center gap-2 px-3 py-2">
                <Scroll className="h-4 w-4 shrink-0 text-cyan" />
                <div className="min-w-0">
                  <p className="price truncate text-[length:var(--type-h3)] leading-none text-cyan">
                    {stats.contracts.toLocaleString()}
                  </p>
                  <p className="label mt-1">Contracts</p>
                </div>
              </div>
              <div className="surface-inset flex items-center gap-2 px-3 py-2">
                <Coins className="h-4 w-4 shrink-0 text-cyan" />
                <div className="min-w-0">
                  <p className="price truncate text-[length:var(--type-h3)] leading-none text-cyan">
                    {formatMoney(stats.wageredUsd)}
                  </p>
                  <p className="label mt-1">Wagered</p>
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <p className="label">Withdrawn to Steam</p>
              <p className="price mt-1 text-[length:var(--type-h3)] text-cyan">{formatMoney(withdrawn.value)}</p>
              <p className="mt-0.5 text-[length:var(--type-micro)] leading-snug text-mute">
                {withdrawn.count} {withdrawn.count === 1 ? "item" : "items"}
                {wagerRemainingUsd > 0 ? ` · playthrough ${formatMoney(wagerRemainingUsd)}` : ""}
              </p>
            </div>
          </section>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-3">
          <section className="surface relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 text-center">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-32"
              style={{
                background:
                  "radial-gradient(ellipse 70% 90% at 50% 0%, rgba(47,221,176,0.14), transparent 72%)",
              }}
            />
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-between gap-3">
              <div className="flex flex-col items-center">
                <div className="rounded-[calc(var(--radius-lg)+2px)] p-px ring-1 ring-cyan/30 shadow-[0_0_36px_rgba(47,221,176,0.14)]">
                  <UserAvatar
                    name={user.username}
                    hue={user.avatarHue}
                    src={user.avatarUrl}
                    size="xl"
                    level={level.level}
                  />
                </div>
                <div
                  className="mt-2 h-1 w-14 overflow-hidden rounded-full bg-white/10"
                  title={`Level ${level.level}`}
                >
                  <div className="h-full rounded-full bg-cyan" style={{ width: `${level.percent}%` }} />
                </div>

                <div className="mt-2.5 flex items-center justify-center gap-1.5">
                  <h1 className="truncate text-[length:var(--type-h2)]">{user.username}</h1>
                  <div className="flex items-center rounded-[var(--radius-xs)] bg-white/[0.04] ring-1 ring-line">
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center text-mute hover:text-ink"
                      aria-label="Settings"
                      onClick={() => router.replace("/profile?tab=account")}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    <span className="h-3 w-px bg-line" />
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center text-mute hover:text-ink"
                      aria-label="Log out"
                      onClick={logout}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {steam.connected ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2 py-0.5 text-[length:var(--type-micro)] text-mute ring-1 ring-line">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                    {steam.personaName ?? "Steam connected"}
                  </span>
                ) : user.id === "local-demo" ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2 py-0.5 text-[length:var(--type-micro)] text-mute ring-1 ring-line">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                    Local session
                  </span>
                ) : (
                  <button type="button" className="meta mt-2 text-cyan" onClick={beginSteamLogin}>
                    Connect Steam
                  </button>
                )}
              </div>

              <div className="w-full max-w-[17rem] rounded-[var(--radius-md)] bg-void/50 px-4 py-2.5 ring-1 ring-line">
                <p className="label">Balance</p>
                <p className="price mt-1 text-[length:var(--type-h2)] leading-none">{formatBalance(balance)}</p>
                <p className="mt-1 text-[length:var(--type-micro)] leading-snug text-mute">Member since {memberSince}</p>
              </div>

              <div className="grid w-full max-w-[17rem] grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  icon={<History className="h-3.5 w-3.5" />}
                  onClick={() => router.replace("/profile?tab=activity")}
                >
                  History
                </Button>
                <Button
                  size="sm"
                  className="w-full"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => router.push("/deposit")}
                >
                  Deposit
                </Button>
              </div>
            </div>
          </section>

          <section className="surface relative shrink-0 overflow-hidden">
            {bestDrop && bestDropSkin ? (
              <>
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[3px]"
                  style={{ background: RARITY_META[bestDrop.snapshot.rarity].color }}
                />
                <div className="flex items-center gap-3 py-3 pr-4 pl-[1.15rem]">
                  <div
                    className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--radius-sm)]"
                    style={{
                      background: `radial-gradient(ellipse 90% 80% at 50% 42%, ${RARITY_META[bestDrop.snapshot.rarity].color}3d, #0c0c10 70%)`,
                      boxShadow: `inset 0 0 0 1px ${RARITY_META[bestDrop.snapshot.rarity].color}40`,
                    }}
                  >
                    <SkinVisual
                      skin={bestDropSkin}
                      framed={false}
                      chrome={false}
                      showWear={false}
                      pad={5}
                      eager
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="label">Best drop</p>
                    {bestDrop.snapshot.name.includes("|") ? (
                      <>
                        <p className="mt-0.5 truncate text-[length:var(--type-micro)] leading-4 text-mute">
                          {bestDrop.snapshot.name.split("|")[0]?.trim()}
                        </p>
                        <p className="truncate font-display text-[length:var(--type-sm)] font-semibold leading-5">
                          {bestDrop.snapshot.name.split("|").slice(1).join("|").trim()}
                        </p>
                      </>
                    ) : (
                      <p className="mt-0.5 truncate font-display text-[length:var(--type-sm)] font-semibold leading-5">
                        {bestDrop.snapshot.name}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <RarityPill rarity={bestDrop.snapshot.rarity} />
                      {isStickerItem(bestDrop.skinId) ? (
                        <Badge tone="outline">N/A</Badge>
                      ) : (
                        <Badge tone="outline">{WEAR_META[bestDrop.wear].short}</Badge>
                      )}
                      {bestDropStatus === "In vault" ? (
                        <Badge tone="accent">In vault</Badge>
                      ) : (
                        <Badge tone="warn">{bestDropStatus}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="price shrink-0 self-center tabular-nums text-[length:var(--type-h2)] leading-none text-cyan">
                    {formatMoney(bestDrop.valueUsd)}
                  </p>
                </div>
              </>
            ) : (
              <div className="min-w-0 w-full px-4 py-3">
                <p className="label">Best drop</p>
                <p className="meta mt-1">Open a case to set the record. The highest pull stays here after you sell it.</p>
              </div>
            )}
          </section>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-3">
          <ProfileFieldCard
            title="Personal coupon"
            value={promoDraft}
            onChange={setPromoDraft}
            placeholder={DEMO_PROMO_CODE}
            ariaLabel="Promo code"
            uppercase
            autoComplete="off"
            spellCheck={false}
            buttonLoading={promoBusy}
            onSubmit={() => {
              const code = promoDraft.trim().toUpperCase();
              if (!code) return;
              setPromoBusy(true);
              void savePromo(code).finally(() => setPromoBusy(false));
            }}
            verified={Boolean(savedPromo)}
            notes={[
              savedPromo
                ? `${savedPromo} · ${promoBonusLabel(savedPromo) ?? "bonus"} on next deposit`
                : `Deposit bonus, e.g. ${DEMO_PROMO_CODE}.`,
              "Adds extra balance. Not for cases or upgrades.",
            ]}
          />

          <ProfileFieldCard
            title="Free case"
            value={casePromoDraft}
            onChange={setCasePromoDraft}
            placeholder="FREE-CASE"
            ariaLabel="Free case coupon"
            uppercase
            autoComplete="off"
            spellCheck={false}
            buttonLoading={casePromoBusy}
            onSubmit={() => {
              const code = casePromoDraft.trim().toUpperCase();
              if (!code) return;
              if (!user) {
                toast({ title: "Sign in to redeem", tone: "warn" });
                return;
              }
              setCasePromoBusy(true);
              void (async () => {
                try {
                  const res = await fetch("/api/case-coupons/redeem", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code }),
                  });
                  const json = (await res.json()) as {
                    ok?: boolean;
                    code?: string;
                    caseId?: string;
                    caseName?: string;
                    opens?: number;
                    claim?: { caseId: string; caseName: string; remaining: number };
                    error?: string;
                    message?: string;
                  };
                  if (!res.ok || !json.ok || !json.claim) {
                    const detail =
                      (json.message && !/^[A-Z][A-Z0-9_]+$/.test(json.message) ? json.message : null) ??
                      "That free-case code could not be applied.";
                    toast({ title: "Could not apply", detail, tone: "err" });
                    return;
                  }
                  saveCasePromo(json.code ?? code);
                  addFreeCaseClaim(json.claim);
                  toast({
                    title: "Free case unlocked",
                    detail: `${json.caseName} · ${json.opens} free open${json.opens === 1 ? "" : "s"}`,
                    tone: "ok",
                  });
                } catch {
                  toast({ title: "Could not apply", detail: "Network error. Try again.", tone: "err" });
                } finally {
                  setCasePromoBusy(false);
                }
              })();
            }}
            verified={Boolean(savedCasePromo || readyFreeCase)}
            notes={[
              readyFreeCase
                ? `${readyFreeCase.caseName} · ${freeCaseOpens} free open${freeCaseOpens === 1 ? "" : "s"} left`
                : savedCasePromo
                  ? `${savedCasePromo} saved — redeem to unlock opens.`
                  : "Apply a code to unlock a free case.",
              "Then open from the case page at $0.",
            ]}
          />

          <ProfileFieldCard
            title="Email"
            value={emailDraft}
            onChange={setEmailDraft}
            placeholder="Contact only — not used to sign in"
            ariaLabel="Optional contact email"
            inputType="email"
            buttonLoading={emailBusy}
            onSubmit={() => {
              const next = emailDraft.trim();
              setEmailBusy(true);
              void setAccountEmail(next)
                .then((ok) => {
                  if (ok) toast({ title: next ? "Email saved" : "Email cleared", tone: "ok" });
                })
                .finally(() => setEmailBusy(false));
            }}
            verified={Boolean(accountEmail)}
            notes={[
              accountEmail ? "Saved as contact only." : "Optional. Leave empty if you prefer.",
              "Never a login. Steam only — notices and support.",
            ]}
          />
        </div>
      </div>

      <InventoryVault compact variant="profile" />

      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title="How to find a trade URL" size="sm">
        <ol className="list-decimal space-y-2 pl-4 text-[length:var(--type-sm)] text-soft">
          <li>Open Steam in a browser while signed in.</li>
          <li>Inventory → Trade Offers → Who can send me Trade Offers?</li>
          <li>Copy the “third-party site” URL (partner + token).</li>
        </ol>
        <p className="meta mt-3">DEMO only. PrismLoot does not call Steam or complete withdrawals.</p>
      </Modal>

      <Modal open={historyOpen} onClose={closePanel} title="History" size="xl">
        <ActivityLedger history={history} />
      </Modal>

      <Modal open={settingsOpen} onClose={closePanel} title="Settings" size="md">
        <SettingsBlock
          liveFeedOn={liveFeedOn}
          reduceMotion={reduceMotion}
          displayCurrency={displayCurrency}
          setSetting={setSetting}
          setCurrency={setCurrency}
          toast={toast}
        />
      </Modal>
    </div>
  );
}

function Amount({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "tabular shrink-0 text-[length:var(--type-sm)] font-semibold",
        value >= 0 ? "text-cyan" : "text-danger",
      )}
    >
      {value >= 0 ? "+" : ""}
      {formatMoney(value)}
    </span>
  );
}

function ActivityLedger({ history }: { history: HistoryEntry[] }) {
  const KINDS = ["all", "open", "upgrade", "contract", "battle", "sell", "deposit"] as const;
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const rows = history.filter((h) => (kind === "all" ? true : h.kind === kind));
  return (
    <div className="section-stack">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((t) => (
          <FilterChip key={t} active={kind === t} onClick={() => setKind(t)}>
            {t}
          </FilterChip>
        ))}
      </div>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <EmptyState
            compact
            title={kind === "all" ? "No operations yet" : `No ${kind} operations`}
            detail={kind === "all" ? undefined : "Try another filter."}
          />
        ) : null}
        {rows.map((entry) => {
          const crate =
            entry.kind === "open"
              ? CASES.find((c) => entry.title.includes(c.name) || entry.detail.includes(c.name))
              : undefined;
          return (
            <div key={entry.id} className="surface flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2">
              {crate ? (
                <CaseVisual crate={crate} size="compact" className="h-12 w-12 shrink-0" />
              ) : (
                <span className="label w-12 shrink-0 text-center">{entry.kind}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[length:var(--type-sm)] font-semibold">{entry.title}</p>
                <p className="meta truncate">
                  {entry.detail}
                  {entry.chance != null ? ` · ${entry.chance}%` : ""} · {timeAgo(entry.at)}
                </p>
              </div>
              <Amount value={entry.amount} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsBlock({
  liveFeedOn,
  reduceMotion,
  displayCurrency,
  setSetting,
  setCurrency,
  toast,
}: {
  liveFeedOn: boolean;
  reduceMotion: boolean;
  displayCurrency: CurrencyCode;
  setSetting: (k: "liveFeedOn" | "reduceMotion", v: boolean) => void;
  setCurrency: (c: CurrencyCode) => void;
  toast: ReturnType<typeof useAppStore>["toast"];
}) {
  return (
    <div className="section-stack">
      <Toggle
        label="Live drop feed"
        detail="Compact ticker above the page"
        on={liveFeedOn}
        onToggle={() => setSetting("liveFeedOn", !liveFeedOn)}
      />
      <Toggle
        label="Reduce motion"
        detail="Shorter spins and fades"
        on={reduceMotion}
        onToggle={() => setSetting("reduceMotion", !reduceMotion)}
      />
      <div className="surface-inset px-3 py-2.5">
        <p className="font-semibold">Display currency</p>
        <p className="meta">One FX snapshot converts every USD quote.</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {DISPLAY_CURRENCIES.map((code) => (
            <FilterChip key={code} active={displayCurrency === code} onClick={() => setCurrency(code)}>
              {code}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[length:var(--type-sm)]">
        <Link className="text-mute hover:text-ink" href="/faq">
          FAQ
        </Link>
        <Link className="text-mute hover:text-ink" href="/fairness">
          Fairness
        </Link>
        <Link className="text-mute hover:text-ink" href="/support">
          Support
        </Link>
      </div>
      <Button
        variant="ghost"
        fullWidth
        onClick={() => {
          localStorage.removeItem("prismloot-prefs-v3");
          localStorage.removeItem("prismloot-demo-v2");
          toast({ title: "Local data reset on next reload", tone: "warn" });
        }}
      >
        Reset local data
      </Button>
    </div>
  );
}

function Toggle({
  label,
  detail,
  on,
  onToggle,
}: {
  label: string;
  detail: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="surface-inset flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-hover"
    >
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="meta block">{detail}</span>
      </span>
      <span className={cn("h-6 w-11 shrink-0 rounded-full p-1 transition-colors", on ? "bg-cyan" : "bg-white/15")}>
        <span className={cn("block h-4 w-4 rounded-full bg-void transition-transform", on && "translate-x-5")} />
      </span>
    </button>
  );
}
