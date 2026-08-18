"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { InventoryVault } from "@/components/inventory/InventoryVault";
import { DEMO_PROMO_CODE } from "@/components/layout/PromoBanner";
import { deriveActivity, memberSinceLabel } from "@/components/profile/activity";
import { deriveLevel } from "@/components/profile/level";
import { Badge, RarityPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Skeleton } from "@/components/ui/Skeleton";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CaseVisual } from "@/components/visuals/CaseVisual";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { looksLikeTradeUrl } from "@/lib/auth/account";
import { ownedBestDropItem, skinFromBestDrop } from "@/lib/bestDrop";
import { CASES } from "@/lib/mock-data";
import { WEAR_META } from "@/lib/rarity";
import { useAppStore } from "@/lib/store";
import type { CurrencyCode, HistoryEntry } from "@/lib/types";
import { DISPLAY_CURRENCIES } from "@/lib/ui/catalog";
import { cn, formatBalance, formatMoney, timeAgo } from "@/lib/utils";
import {
  Check,
  HelpCircle,
  History,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type ReactNode } from "react";

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
    hydrated,
    login,
    logout,
    liveFeedOn,
    reduceMotion,
    displayCurrency,
    setSetting,
    setCurrency,
    toast,
    savedPromo,
    savePromo,
    tradeUrl,
    setTradeUrl,
    accountEmail,
    setAccountEmail,
    steam,
    beginSteamLogin,
    wagerRemainingUsd,
  } = store;

  const panel = params.get("tab");
  const historyOpen = panel === "activity";
  const settingsOpen = panel === "account";

  const [guideOpen, setGuideOpen] = useState(false);
  const [promoDraft, setPromoDraft] = useSyncedDraft(savedPromo ?? "");
  const [tradeDraft, setTradeDraft] = useSyncedDraft(tradeUrl);
  const [tradeEditing, setTradeEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useSyncedDraft(accountEmail);

  const level = useMemo(() => deriveLevel(stats, inventoryValue), [stats, inventoryValue]);
  const activity = useMemo(() => deriveActivity(history), [history]);
  const memberSince = useMemo(() => memberSinceLabel(history, inventory), [history, inventory]);

  const bestDrop = stats.bestDrop;
  const bestDropSkin = useMemo(() => (bestDrop ? skinFromBestDrop(bestDrop) : null), [bestDrop]);
  const bestDropOwned = useMemo(
    () => (bestDrop ? ownedBestDropItem(bestDrop, inventory) : undefined),
    [bestDrop, inventory],
  );

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
    setTradeEditing(false);
    toast({
      title: next ? "Trade URL saved" : "Trade URL cleared",
      detail: next ? "Нужна, чтобы вывести скин из инвентаря." : "Вывод скинов будет недоступен, пока ссылка пустая.",
      tone: "ok",
    });
  }

  function applyPromo() {
    const code = promoDraft.trim().toUpperCase();
    if (!code) {
      toast({ title: "Enter a code", detail: `Try ${DEMO_PROMO_CODE}.`, tone: "warn" });
      return;
    }
    savePromo(code);
  }

  if (!user) {
    return (
      <div className="page-stack">
        <div className="surface surface-pad mx-auto max-w-md text-center">
          <h1>Sign in</h1>
          <p className="mt-2 text-[length:var(--type-sm)] text-mute">
            Login + password. Steam sign-in is coming soon.
          </p>
          <div className="mt-4 text-left">
            <LoginForm onSuccess={login} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="surface-pad flex flex-wrap items-center gap-x-5 gap-y-4">
          <UserAvatar name={user.username} hue={user.avatarHue} size="xl" level={level.level} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 truncate">{user.username}</h1>
              <Badge tone="accent">Level {level.level}</Badge>
            </div>
            <p className="meta mt-1.5">
              Member since {memberSince}
              {accountEmail ? ` · ${accountEmail}` : " · no email on file"}
            </p>
            <div className="mt-3 max-w-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="label">Progress</span>
                <span className="meta tabular">
                  {level.into.toLocaleString()} / {level.span.toLocaleString()} XP
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-graphite">
                <div
                  className="h-full rounded-full bg-cyan transition-[width] duration-[var(--dur-slow)] ease-[var(--ease)]"
                  style={{ width: `${level.percent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5 sm:items-end">
            <div className="sm:text-right">
              <p className="label">Balance</p>
              <p className="price mt-0.5 text-[length:var(--type-h1)] leading-tight">{formatBalance(balance)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => router.push("/deposit")}>
                Add funds
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<History className="h-3.5 w-3.5" />}
                onClick={() => router.replace("/profile?tab=activity")}
              >
                History
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Settings className="h-3.5 w-3.5" />}
                onClick={() => router.replace("/profile?tab=account")}
              >
                Settings
              </Button>
              <Button size="sm" variant="quiet" icon={<LogOut className="h-3.5 w-3.5" />} onClick={logout}>
                Log out
              </Button>
            </div>
          </div>
        </div>

        <div className="surface-pad grid grid-cols-2 gap-3 border-t border-line sm:grid-cols-3 lg:grid-cols-5">
          <StatCell label="Cases opened" value={stats.openedCases.toLocaleString()} />
          <StatCell label="Upgrades" value={stats.upgrades.toLocaleString()} />
          <StatCell label="Contracts" value={stats.contracts.toLocaleString()} />
          <StatCell label="Battles" value={stats.battles.toLocaleString()} />
          <StatCell label="Vault value" value={formatMoney(inventoryValue)} className="col-span-2 sm:col-span-1" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Account" description="Your PrismLoot account — we never ask for a Steam password.">
          <div className="flex gap-2">
            <input
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
              aria-label="Account email"
              type="email"
              className="field min-w-0 flex-1"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const next = emailDraft.trim();
                setAccountEmail(next);
                toast({ title: next ? "Email saved locally" : "Email cleared", tone: "ok" });
              }}
            >
              Save
            </Button>
          </div>
          <InfoRow label="Member since">{memberSince}</InfoRow>
          <InfoRow label="Playthrough left">
            {wagerRemainingUsd > 0 ? (
              <span className="tabular text-warn">{formatMoney(wagerRemainingUsd)}</span>
            ) : (
              <span className="text-mute">None — withdrawals unlocked</span>
            )}
          </InfoRow>
          <InfoRow label="Steam">
            <Button size="xs" variant="ghost" onClick={beginSteamLogin}>
              {steam.connected ? "Linked" : "Connect"}
            </Button>
          </InfoRow>
        </Card>

        <Card title="Statistics" description="Derived from your activity log.">
          <InfoRow label="Cases opened">{stats.openedCases.toLocaleString()}</InfoRow>
          <InfoRow label="Upgrades won / lost">
            <span className="tabular">
              <span className="text-cyan">{activity.upgradesWon}</span>
              <span className="text-mute"> / </span>
              <span className="text-danger">{activity.upgradesLost}</span>
            </span>
          </InfoRow>
          <InfoRow label="Contracts">{stats.contracts.toLocaleString()}</InfoRow>
          <InfoRow label="Total wagered">
            <span className="tabular">{formatMoney(activity.wagered)}</span>
          </InfoRow>
          <InfoRow label="Playthrough left">
            {wagerRemainingUsd > 0 ? (
              <span className="tabular">{formatMoney(wagerRemainingUsd)}</span>
            ) : (
              <span className="text-mute">Cleared</span>
            )}
          </InfoRow>
          <InfoRow label="Best multiplier">
            {activity.bestMultiplier ? (
              <span className="tabular">{activity.bestMultiplier.toFixed(2)}×</span>
            ) : (
              <span className="text-mute">No upgrade wins yet</span>
            )}
          </InfoRow>
        </Card>

        <Card
          id="trade"
          title="Trade settings"
          description="Трейд-ссылка Steam. Без неё вывод скина не создаётся."
          actions={
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-[var(--radius-xs)] text-mute transition-colors hover:bg-white/[0.06] hover:text-ink"
              aria-label="How to find a trade URL"
              title="How to find a trade URL"
              onClick={() => setGuideOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          }
        >
          <div className="flex gap-2">
            <input
              value={tradeDraft}
              onChange={(e) => setTradeDraft(e.target.value)}
              readOnly={!tradeEditing}
              placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…"
              aria-label="Trade URL"
              className={cn("field min-w-0 flex-1", !tradeEditing && "text-mute")}
            />
            {tradeEditing ? (
              <>
                <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={saveTradeUrl}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => {
                    setTradeDraft(tradeUrl);
                    setTradeEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={() => setTradeEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
          <p className="meta">
            {tradeUrl
              ? "Сохранена. Вывод скина из инвентаря отправит заявку админу."
              : wagerRemainingUsd > 0
                ? `Отыграйте ${formatMoney(wagerRemainingUsd)} в кейсах, апгрейдах или контрактах, затем выведите скин из инвентаря.`
                : "Обязательна для вывода. Вставь ссылку вида https://steamcommunity.com/tradeoffer/new/?partner=…"}
          </p>
        </Card>

        <Card title="Promo" description="Codes are stored with your account.">
          <div className="flex gap-2">
            <input
              value={promoDraft}
              onChange={(e) => setPromoDraft(e.target.value.toUpperCase())}
              placeholder={DEMO_PROMO_CODE}
              aria-label="Promo code"
              className="field min-w-0 flex-1 uppercase"
            />
            <Button size="sm" icon={<Ticket className="h-3.5 w-3.5" />} onClick={applyPromo}>
              Apply
            </Button>
          </div>
          {savedPromo ? (
            <div className="flex items-center gap-2">
              <Badge tone="gold">{savedPromo}</Badge>
              <span className="meta">saved to this account</span>
            </div>
          ) : (
            <p className="meta">No code applied. Try {DEMO_PROMO_CODE}.</p>
          )}
        </Card>

        <Card title="Best drop" description="Highest-value item you've ever obtained — kept even after you sell it.">
          {bestDrop && bestDropSkin ? (
            <div className="flex items-center gap-3">
              <div className="surface-inset relative h-20 w-28 shrink-0 overflow-hidden">
                <SkinVisual
                  skin={bestDropSkin}
                  framed={false}
                  chrome={false}
                  showWear={false}
                  pad={8}
                  className="h-full w-full"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{bestDrop.snapshot.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <RarityPill rarity={bestDrop.snapshot.rarity} />
                  <Badge tone="outline">{WEAR_META[bestDrop.wear].short}</Badge>
                  {bestDropOwned ? (
                    <Link
                      href="/inventory"
                      className="text-[length:var(--type-meta)] font-semibold text-cyan hover:brightness-110"
                    >
                      In vault
                    </Link>
                  ) : (
                    <Badge tone="warn">Sold</Badge>
                  )}
                </div>
                <p className="price mt-1.5">{formatMoney(bestDrop.valueUsd)}</p>
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              title="No drops yet"
              detail="Open a case to set the record."
              action={
                <Button size="sm" onClick={() => router.push("/cases")}>
                  Open a case
                </Button>
              }
            />
          )}
        </Card>

        <Card
          title="History"
          description="Latest operations on this account."
          actions={
            <Link href="/history" className="text-[length:var(--type-meta)] font-semibold text-cyan hover:brightness-110">
              View all
            </Link>
          }
        >
          {!hydrated ? (
            <div className="space-y-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState compact title="No operations yet" detail="Open a case to start the log." />
          ) : (
            <ul className="-mr-1 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {history.slice(0, 12).map((entry) => (
                <li key={entry.id} className="surface-inset flex items-center gap-2.5 px-2.5 py-2">
                  <span className="label w-16 shrink-0">{entry.kind}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[length:var(--type-sm)] font-semibold leading-tight">{entry.title}</p>
                    <p className="meta truncate">
                      {entry.detail} · {timeAgo(entry.at)}
                    </p>
                  </div>
                  <Amount value={entry.amount} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <InventoryVault compact />

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

function Card({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="surface surface-pad section-stack">
      <SectionHeading title={title} description={description} actions={actions} />
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5 last:border-0 last:pb-0">
      <span className="label">{label}</span>
      <span className="min-w-0 truncate text-[length:var(--type-sm)] text-soft">{children}</span>
    </div>
  );
}

function StatCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("surface-inset min-w-0 px-3 py-2", className)}>
      <p className="price truncate text-[length:var(--type-sm)]">{value}</p>
      <p className="label mt-0.5">{label}</p>
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
