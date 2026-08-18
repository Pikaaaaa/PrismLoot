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
  asset: string;
  network: string;
  amountUsd: number;
  amountCrypto: number;
  status: string;
  txNote: string;
  createdAt: string;
};

function tone(status: string): "warn" | "accent" | "danger" | "outline" {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED") return "accent";
  if (status === "REJECTED") return "danger";
  return "outline";
}

export default function AdminDepositsPage() {
  const [status, setStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = status === "ALL" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/deposits${q}`);
      const json = (await res.json()) as { ok?: boolean; deposits?: Row[]; pending?: number; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to load");
        return;
      }
      setError(null);
      setRows(json.deposits ?? []);
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
      const res = await fetch("/api/admin/deposits", {
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
        title="Deposits"
        description="Pending crypto cashier requests. Approve credits USD to the player ledger."
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
              <th>Asset</th>
              <th>USD</th>
              <th>Note</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 meta">{timeAgo(Date.parse(row.createdAt))}</td>
                <td className="font-semibold">{row.user ?? row.userId}</td>
                <td>
                  {row.asset}
                  <span className="meta"> · {row.network}</span>
                </td>
                <td className="tabular">{formatMoney(row.amountUsd)}</td>
                <td className="meta max-w-48 truncate">{row.txNote || "—"}</td>
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
          <EmptyState compact title="No deposits" detail="Create one on /deposit, then approve here." />
        ) : null}
      </div>
    </div>
  );
}
