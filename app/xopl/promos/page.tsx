"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useEffect, useState } from "react";

type Promo = {
  id: string;
  code: string;
  percentBonus: number;
  enabled: boolean;
  redemptions: number;
  note: string;
};

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("20");

  async function load() {
    const res = await fetch("/api/admin/promos");
    const json = await res.json();
    if (json.ok) setPromos(json.promos ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, percentBonus: Number(percent) }),
    });
    setCode("");
    await load();
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch("/api/admin/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    await load();
  }

  return (
    <div className="page-stack">
      <PageHeader kicker="Admin" title="Promo codes" description="SOLAR-20 is seeded. Codes apply from Profile." />
      <div className="surface surface-pad flex flex-wrap items-end gap-3">
        <label>
          <span className="label">Code</span>
          <input className="field mt-1 uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label>
          <span className="label">Bonus %</span>
          <input className="field mt-1 w-24" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </label>
        <Button size="sm" onClick={() => void create()}>
          Create
        </Button>
      </div>
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">Code</th>
              <th>Bonus</th>
              <th>Redeems</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {promos.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 font-semibold">{row.code}</td>
                <td>+{row.percentBonus}%</td>
                <td>{row.redemptions}</td>
                <td className="meta">{row.enabled ? "On" : "Off"}</td>
                <td>
                  <Button size="xs" variant="ghost" onClick={() => void toggle(row.id, !row.enabled)}>
                    {row.enabled ? "Disable" : "Enable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
