"use client";

import { useConsoleHref } from "@/components/admin/admin-path";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBalance, formatMoney, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type UserDetail = {
  id: string;
  displayName: string;
  role: string;
  banned: boolean;
  balanceUsd: number;
  wagerRemainingUsd: number;
  tradeUrl?: string;
  vaultValue: number;
  createdAt: string;
  bestDrop: {
    name: string;
    priceUsd: number;
    wear: string;
    sold: boolean;
    obtainedAt: string;
  } | null;
  inventory: Array<{
    id: string;
    name: string;
    wear: string;
    source: string;
    priceUsd: number;
    soldAt: string | null;
    acquiredAt: string;
  }>;
  ledger: Array<{ id: string; kind: string; amountUsd: number; note: string; at: string }>;
  deposits: Array<{
    id: string;
    asset: string;
    network: string;
    amountUsd: number;
    status: string;
    at: string;
  }>;
};

export default function AdminUserDetailPage() {
  const depositsHref = useConsoleHref("/deposits");
  const withdrawalsHref = useConsoleHref("/withdrawals");
  const usersHref = useConsoleHref("/users");
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [delta, setDelta] = useState("10");
  const [setTo, setSetTo] = useState("");
  const [reason, setReason] = useState("");
  const [grantId, setGrantId] = useState("");
  const [tradeDraft, setTradeDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${id}`);
    const json = (await res.json()) as { ok?: boolean; user?: UserDetail; error?: string };
    if (!res.ok || !json.ok || !json.user) {
      setError(json.error ?? "Failed to load");
      return;
    }
    setError(null);
    setUser(json.user);
    setTradeDraft(json.user.tradeUrl ?? "");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Update failed");
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="page-stack">
        <PageHeader kicker="Admin" title="User" />
        <p className="text-sm text-mute">{error ?? "Loading…"}</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Users"
        title={user.displayName}
        description={`${user.id} · ${user.role} · joined ${timeAgo(Date.parse(user.createdAt))}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={depositsHref} className="text-sm font-semibold text-cyan">
              Deposits
            </Link>
            <Link href={withdrawalsHref} className="text-sm font-semibold text-cyan">
              Withdrawals
            </Link>
            <Link href={usersHref} className="text-sm font-semibold text-cyan">
              All users
            </Link>
          </div>
        }
      />
      {user.banned ? (
        <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          This account is banned. Case opens, upgrades, contracts and deposits are blocked.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface surface-pad">
          <p className="label">Balance</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatBalance(user.balanceUsd)}</p>
        </div>
        <div className="surface surface-pad">
          <p className="label">Wager left</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatMoney(user.wagerRemainingUsd ?? 0)}</p>
          <p className="meta mt-1">{(user.wagerRemainingUsd ?? 0) > 0 ? "Blocks withdrawals" : "Cleared"}</p>
        </div>
        <div className="surface surface-pad">
          <p className="label">Vault value</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatMoney(user.vaultValue)}</p>
        </div>
        <div className="surface surface-pad">
          <p className="label">Best drop</p>
          {user.bestDrop ? (
            <>
              <p className="mt-1 font-semibold">{user.bestDrop.name}</p>
              <p className="meta">
                {formatMoney(user.bestDrop.priceUsd)}
                {user.bestDrop.sold ? " · sold" : ""}
              </p>
            </>
          ) : (
            <p className="meta mt-1">None yet</p>
          )}
        </div>
      </div>
      <div className="surface surface-pad flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-40 flex-1">
            <span className="label">Add / subtract USD</span>
            <input className="field mt-1" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </label>
          <Button
            size="sm"
            loading={busy}
            onClick={() => void patch({ balanceDelta: Number(delta), reason })}
          >
            Apply delta
          </Button>
          <label className="min-w-40 flex-1">
            <span className="label">Set balance to</span>
            <input className="field mt-1" value={setTo} placeholder={String(user.balanceUsd)} onChange={(e) => setSetTo(e.target.value)} />
          </label>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => void patch({ setBalanceUsd: Number(setTo), reason })}
          >
            Set
          </Button>
        </div>
        <label>
          <span className="label">Reason (ledger + audit)</span>
          <input className="field mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Promo, refund, test…" />
        </label>
        <div>
          <Button
            size="sm"
            variant={user.banned ? "secondary" : "danger"}
            loading={busy}
            onClick={() => void patch({ banned: !user.banned, reason })}
          >
            {user.banned ? "Unban player" : "Ban player"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            disabled={(user.wagerRemainingUsd ?? 0) <= 0}
            onClick={() => setResetOpen(true)}
          >
            Сбросить вагер
          </Button>
          <p className="meta">
            {(user.wagerRemainingUsd ?? 0) > 0
              ? `Отыгровка ${formatMoney(user.wagerRemainingUsd)} → 0. Игрок сможет выводить.`
              : "Отыгровка уже 0."}
          </p>
        </div>
      </div>
      <div className="surface surface-pad flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="label">Trade URL</span>
          <input
            className="field mt-1"
            placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…"
            value={tradeDraft}
            onChange={(e) => setTradeDraft(e.target.value)}
          />
        </label>
        <Button size="sm" loading={busy} onClick={() => void patch({ tradeUrl: tradeDraft })}>
          Save trade URL
        </Button>
      </div>
      <div className="surface surface-pad flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="label">Grant skin id</span>
          <input className="field mt-1" placeholder="ak-redline" value={grantId} onChange={(e) => setGrantId(e.target.value)} />
        </label>
        <Button size="sm" loading={busy} onClick={() => void patch({ grantSkinId: grantId })}>
          Grant
        </Button>
      </div>
      <div className="surface overflow-x-auto">
        <div className="surface-pad">
          <h2>Inventory</h2>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">Item</th>
              <th>Wear</th>
              <th>Source</th>
              <th>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {user.inventory.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 font-semibold">
                  {row.name}
                  {row.soldAt ? (
                    <Badge tone="outline" className="ml-2">
                      Sold
                    </Badge>
                  ) : null}
                </td>
                <td className="meta uppercase">{row.wear}</td>
                <td className="meta">{row.source}</td>
                <td className="tabular">{formatMoney(row.priceUsd)}</td>
                <td>
                  {!row.soldAt ? (
                    <Button size="xs" variant="ghost" onClick={() => void patch({ revokeId: row.id })}>
                      Revoke
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="surface overflow-x-auto">
        <div className="surface-pad">
          <h2>Ledger</h2>
        </div>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">Kind</th>
              <th>Amount</th>
              <th>Note</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {user.ledger.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 meta">{row.kind}</td>
                <td className="tabular">{formatMoney(row.amountUsd)}</td>
                <td>{row.note}</td>
                <td className="meta">{timeAgo(Date.parse(row.at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Сбросить вагер"
        description={`${user.displayName} · отыгровка ${formatMoney(user.wagerRemainingUsd ?? 0)}`}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setResetOpen(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              loading={busy}
              onClick={() => {
                void patch({ resetWager: true, reason }).then((ok) => {
                  if (ok) setResetOpen(false);
                });
              }}
            >
              Обнулить
            </Button>
          </div>
        }
      >
        <p className="text-sm text-soft">
          Отыгровка станет 0. Игрок сможет запросить вывод (если нет другой блокировки). Баланс не меняется.
        </p>
      </Modal>
    </div>
  );
}
