"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { DEFAULT_WAGER_MULTIPLIER, formatWagerMultiplier, WAGER_PRESETS } from "@/lib/gift-cards/wager";
import { formatMoney, timeAgo } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

type Card = {
  id: string;
  code: string;
  amountUsd: number;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  redeemedBy: string | null;
  redeemedAt: string | null;
  note: string;
  wagerMultiplier: number;
};

function tone(status: string): "accent" | "warn" | "danger" | "outline" {
  if (status === "UNUSED") return "accent";
  if (status === "REDEEMED") return "outline";
  if (status === "DISABLED") return "danger";
  return "warn";
}

function looksLikeErrorCode(value?: string) {
  return Boolean(value && /^[A-Z][A-Z0-9_]+$/.test(value));
}

function humanAdminError(code?: string) {
  if (!code) return null;
  if (code === "GIFT_CARD_UNAVAILABLE") return "Gift cards could not be processed. Try again.";
  if (code === "GIFT_CARD_INVALID") return "That gift card was not found.";
  if (code === "GIFT_CARD_USED") return "This card was already redeemed — it cannot be disabled.";
  if (code === "AMOUNT_TOO_LOW") return "Amount must be at least $1.";
  if (code === "INVALID_INPUT") return "Check amount, quantity and expiry, then try again.";
  if (code === "CREATE_FAILED") return "Could not create gift cards.";
  if (code === "DISABLE_FAILED") return "Could not disable that card.";
  if (code === "UNAUTHORIZED") return "Admin session expired. Sign in again.";
  if (looksLikeErrorCode(code)) return "Something went wrong. Try again.";
  return code;
}

function displayAdminError(json: { message?: string; error?: string }, fallback: string) {
  const mapped = humanAdminError(json.error);
  if (mapped) return mapped;
  if (json.message && !looksLikeErrorCode(json.message)) return json.message;
  return fallback;
}

export default function AdminGiftCardsPage() {
  const [status, setStatus] = useState<"ALL" | "UNUSED" | "REDEEMED" | "DISABLED">("ALL");
  const [rows, setRows] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState("25");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [wagerMultiplier, setWagerMultiplier] = useState(DEFAULT_WAGER_MULTIPLIER);
  const [wagerCustom, setWagerCustom] = useState(String(DEFAULT_WAGER_MULTIPLIER));
  const [created, setCreated] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const q = status === "ALL" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/gift-cards${q}`);
      const json = (await res.json()) as { ok?: boolean; cards?: Card[]; error?: string; message?: string };
      if (res.status === 401) {
        setError("Admin session expired. Sign in again.");
        setRows([]);
        return;
      }
      const cards = Array.isArray(json.cards) ? json.cards : [];
      setRows(cards);
      if (!res.ok || json.ok === false) {
        setError(displayAdminError(json, "Could not load gift cards."));
        return;
      }
      setError(null);
    } catch {
      setError("Could not load gift cards.");
      setRows([]);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectWager(value: number) {
    setWagerMultiplier(value);
    setWagerCustom(String(value));
  }

  async function create() {
    setBusy("create");
    setCreated([]);
    try {
      const custom = Number(wagerCustom);
      const multiplier = Number.isFinite(custom) && custom >= 0 ? custom : wagerMultiplier;
      const res = await fetch("/api/admin/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: Number(amount),
          quantity: Number(quantity),
          note,
          expiresAt: expiresAt || undefined,
          wagerMultiplier: multiplier,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; cards?: Card[]; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        setError(displayAdminError(json, "Could not create gift cards."));
        return;
      }
      setCreated((json.cards ?? []).map((row) => row.code));
      setNote("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function disable(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/gift-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "DISABLE" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        setError(displayAdminError(json, "Could not disable that card."));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Admin"
        title="Gift cards"
        description="Issue PrismLoot codes (PL-XXXX-XXXX-XXXX). One redeem each. Credits USD on /deposit with a playthrough multiplier."
      />

      <div className="surface surface-pad flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="label">Amount USD</span>
            <input className="field mt-1 w-28 tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            <span className="label">Quantity</span>
            <input className="field mt-1 w-20 tabular" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            <span className="label">Expires (optional)</span>
            <input className="field mt-1" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
          <label className="min-w-48 flex-1">
            <span className="label">Note</span>
            <input className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Partner drop, stream, …" />
          </label>
          <Button size="sm" loading={busy === "create"} onClick={() => void create()}>
            Generate
          </Button>
        </div>
        <div>
          <p className="label mb-2">Wager / playthrough</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {WAGER_PRESETS.map((value) => (
              <FilterChip key={value} active={wagerMultiplier === value} onClick={() => selectWager(value)}>
                {value === 0 ? "None" : `x${value}`}
              </FilterChip>
            ))}
            <label className="ml-1 flex items-center gap-1.5">
              <span className="label">Custom</span>
              <input
                className="field h-8 w-16 tabular"
                value={wagerCustom}
                onChange={(e) => {
                  setWagerCustom(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0) setWagerMultiplier(n);
                }}
                inputMode="decimal"
              />
            </label>
          </div>
          <p className="meta mt-2">
            On redeem, balance +${amount || "0"} and playthrough {formatWagerMultiplier(wagerMultiplier)}
            {wagerMultiplier > 0
              ? ` (must wager ${formatMoney(Number(amount || 0) * wagerMultiplier)} in cases, upgrades, and contracts).`
              : " (can cash out immediately)."}
          </p>
        </div>
      </div>

      {created.length ? (
        <div className="surface surface-pad">
          <p className="label">New codes</p>
          <ul className="mt-2 space-y-1 font-mono text-sm text-cyan">
            {created.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["ALL", "UNUSED", "REDEEMED", "DISABLED"] as const).map((value) => (
          <FilterChip key={value} active={status === value} onClick={() => setStatus(value)}>
            {value}
          </FilterChip>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">Code</th>
              <th>USD</th>
              <th>Wager</th>
              <th>Status</th>
              <th>Created</th>
              <th>Redeemed</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 font-mono text-xs font-semibold">{row.code}</td>
                <td className="tabular">{formatMoney(row.amountUsd)}</td>
                <td>
                  <Badge tone={row.wagerMultiplier > 0 ? "warn" : "outline"}>
                    {formatWagerMultiplier(row.wagerMultiplier ?? 0)}
                  </Badge>
                </td>
                <td>
                  <Badge tone={tone(row.status)}>{row.status}</Badge>
                </td>
                <td className="meta">{timeAgo(Date.parse(row.createdAt))}</td>
                <td className="meta">
                  {row.redeemedBy
                    ? `${row.redeemedBy} · ${row.redeemedAt ? timeAgo(Date.parse(row.redeemedAt)) : ""}`
                    : "—"}
                </td>
                <td className="meta max-w-40 truncate">{row.note || "—"}</td>
                <td>
                  {row.status === "UNUSED" ? (
                    <Button size="xs" variant="danger" loading={busy === row.id} onClick={() => void disable(row.id)}>
                      Disable
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <EmptyState compact title="No gift cards yet." detail="Generate codes above." /> : null}
      </div>
    </div>
  );
}
