"use client";

import { useConsoleHref } from "@/components/admin/admin-path";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type Dash = {
  stats: {
    users: number;
    vaultValue: number;
    opensToday: number;
    opensAll: number;
    revenue: number;
    payouts: number;
    ggr: number;
  };
  recentOpens: Array<{
    id: string;
    user: string;
    caseName: string;
    skinName: string;
    costUsd: number;
    payoutUsd: number;
    at: string;
  }>;
  recentLedger: Array<{
    id: string;
    user: string;
    kind: string;
    amountUsd: number;
    note: string;
    at: string;
  }>;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface surface-pad">
      <p className="label">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
      {hint ? <p className="meta mt-1">{hint}</p> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const dropsHref = useConsoleHref("/drops");
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/dashboard");
        const json = (await res.json()) as Dash & { ok?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Failed to load");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Admin"
        title="Dashboard"
        description="Live SQLite totals. Open a case on the public site to see drops land here."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={data ? String(data.stats.users) : "—"} />
        <Stat label="Vault value" value={data ? formatMoney(data.stats.vaultValue) : "—"} hint="Unsold inventory at catalog price" />
        <Stat label="Opens today" value={data ? String(data.stats.opensToday) : "—"} hint={data ? `${data.stats.opensAll} all-time` : undefined} />
        <Stat
          label="GGR"
          value={data ? formatMoney(data.stats.ggr) : "—"}
          hint={data ? `Revenue ${formatMoney(data.stats.revenue)} − payouts ${formatMoney(data.stats.payouts)}` : "Opens revenue minus drop quotes"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface overflow-x-auto">
          <div className="surface-pad flex items-center justify-between">
            <h2>Recent opens</h2>
            <Link href={dropsHref} className="text-xs font-semibold text-cyan">
              Live log
            </Link>
          </div>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-graphite text-xs uppercase text-mute">
              <tr>
                <th className="p-3">User</th>
                <th>Case</th>
                <th>Skin</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOpens ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="p-3 font-semibold">{row.user}</td>
                  <td>{row.caseName}</td>
                  <td>{row.skinName}</td>
                  <td className="meta">{timeAgo(Date.parse(row.at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.recentOpens.length ? <p className="meta p-3">No opens recorded yet.</p> : null}
        </div>
        <div className="surface overflow-x-auto">
          <div className="surface-pad">
            <h2>Ledger</h2>
          </div>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-graphite text-xs uppercase text-mute">
              <tr>
                <th className="p-3">User</th>
                <th>Kind</th>
                <th>Amount</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentLedger ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="p-3 font-semibold">{row.user}</td>
                  <td className="meta">{row.kind}</td>
                  <td className="tabular">{formatMoney(row.amountUsd)}</td>
                  <td className="meta">{timeAgo(Date.parse(row.at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.recentLedger.length ? <p className="meta p-3">No ledger rows yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
