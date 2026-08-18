"use client";

import { useConsoleHref } from "@/components/admin/admin-path";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { RTP_PRESETS } from "@/lib/economy/rtp";
import { formatMoney } from "@/lib/utils";
import { useState } from "react";

export type EconomyRow = {
  id: string;
  name: string;
  price: number;
  preset: string;
  rtp: number;
  houseEdge: number;
  theoreticalEV: number;
  theoreticalRtp: number;
  opens: number;
  revenue: number;
  payout: number;
  profit: number;
  actualRtp: number;
};

export function EconomyLab({ rows, liveCount }: { rows: EconomyRow[]; liveCount: number }) {
  const pricesHref = useConsoleHref("/prices");
  const [sim, setSim] = useState("");
  const [busy, setBusy] = useState(false);

  async function simulate(caseId: string, n: number) {
    setBusy(true);
    const res = await fetch("/api/admin/economy/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, n }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setSim(data.error);
      return;
    }
    const r = data.result;
    setSim(
      `${r.n.toLocaleString("en-US")} rolls · sim RTP ${(r.simulatedRtp * 100).toFixed(2)}% vs theo ${(r.theoreticalRtp * 100).toFixed(2)}% · profit ${formatMoney(r.profit)}${r.message ? ` · ${r.message}` : ""} · live opens ${liveCount}`,
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Developer"
        title="Economy lab"
        description="House edge is baked into each case RTP. Simulation never changes player odds."
        actions={
          <a href={pricesHref}>
            <Button size="sm" variant="ghost">
              Prices
            </Button>
          </a>
        }
      />
      <div className="flex flex-wrap gap-2">
        {Object.values(RTP_PRESETS).map((p) => (
          <span key={p.label} className="rounded-full border border-line bg-white/5 px-3 py-1 text-xs">
            {p.label}
          </span>
        ))}
      </div>
      {sim ? <p className="surface surface-pad text-sm">{sim}</p> : null}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">Case</th>
              <th>Price</th>
              <th>Theo RTP</th>
              <th>Edge</th>
              <th>EV</th>
              <th>Opens</th>
              <th>Actual RTP</th>
              <th>Profit</th>
              <th>Sim</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 font-semibold">{r.name}</td>
                <td>{formatMoney(r.price)}</td>
                <td>{(r.theoreticalRtp * 100).toFixed(0)}%</td>
                <td>{(r.houseEdge * 100).toFixed(0)}%</td>
                <td>{formatMoney(r.theoreticalEV)}</td>
                <td>{r.opens}</td>
                <td>{r.opens ? `${(r.actualRtp * 100).toFixed(1)}%` : "—"}</td>
                <td>{formatMoney(r.profit)}</td>
                <td className="space-x-1 py-2">
                  {[10, 100, 1000, 10_000].map((n) => (
                    <Button key={n} size="sm" variant="ghost" disabled={busy} onClick={() => void simulate(r.id, n)}>
                      {n >= 1000 ? `${n / 1000}k` : n}
                    </Button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" onClick={() => void simulate(rows[0]?.id, 100_000)} disabled={busy || !rows[0]}>
        Simulate 100k on first case
      </Button>
    </div>
  );
}
