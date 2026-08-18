"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney, timeAgo } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  user?: string;
  userId?: string;
  amountUsd: number;
  status: string;
  kind?: string;
  itemName?: string;
  tradeUrl?: string;
  note: string;
  createdAt: string;
};

function tone(status: string): "warn" | "accent" | "danger" | "outline" {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED") return "accent";
  if (status === "REJECTED") return "danger";
  return "outline";
}

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = status === "ALL" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/withdrawals${q}`);
      const json = (await res.json()) as {
        ok?: boolean;
        withdrawals?: Row[];
        pending?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to load");
        return;
      }
      setError(null);
      setRows(json.withdrawals ?? []);
      setPending(json.pending ?? 0);
    } catch {
      setError("Failed to load");
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: "APPROVED" | "REJECTED") {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Review failed");
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
        title="Withdrawals"
        description="Skin requests from inventory. Approve keeps the item held; reject returns it to the vault."
        actions={<Badge tone="warn">{pending} pending</Badge>}
      />
      <div className="flex flex-wrap gap-2">
        {(["PENDING", "ALL", "APPROVED", "REJECTED"] as const).map((value) => (
          <FilterChip key={value} active={status === value} onClick={() => setStatus(value)}>
            {value}
          </FilterChip>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">When</th>
              <th>User</th>
              <th>Item</th>
              <th>Trade URL</th>
              <th>USD</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 meta">{timeAgo(Date.parse(row.createdAt))}</td>
                <td className="font-semibold">{row.user ?? row.userId}</td>
                <td className="max-w-64 truncate font-semibold">
                  {row.kind === "SKIN" ? row.itemName || row.note || "Skin" : "Balance"}
                </td>
                <td className="max-w-56 p-2">
                  {row.tradeUrl ? (
                    <a
                      href={row.tradeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs font-semibold text-cyan hover:brightness-110"
                      title={row.tradeUrl}
                    >
                      {row.tradeUrl}
                    </a>
                  ) : (
                    <span className="meta">—</span>
                  )}
                </td>
                <td className="tabular">{formatMoney(row.amountUsd)}</td>
                <td>
                  <Badge tone={tone(row.status)}>{row.status}</Badge>
                </td>
                <td>
                  {row.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button size="xs" loading={busy === row.id} onClick={() => void review(row.id, "APPROVED")}>
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        loading={busy === row.id}
                        onClick={() => void review(row.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <EmptyState
            compact
            title="No withdrawals"
            detail="Players request a skin withdrawal from inventory or profile."
          />
        ) : null}
      </div>
    </div>
  );
}
