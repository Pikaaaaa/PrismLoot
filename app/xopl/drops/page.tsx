"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney, timeAgo } from "@/lib/utils";
import { useEffect, useState } from "react";

type OpenRow = {
  id: string;
  user: string;
  caseName: string;
  skinName: string;
  rarity: string;
  wear: string;
  costUsd: number;
  payoutUsd: number;
  at: string;
};

export default function AdminDropsPage() {
  const [opens, setOpens] = useState<OpenRow[]>([]);

  useEffect(() => {
    let timer = 0;
    async function pull() {
      const res = await fetch("/api/admin/drops");
      const json = await res.json();
      if (json.ok) setOpens(json.opens ?? []);
    }
    void pull();
    timer = window.setInterval(() => void pull(), 4000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="page-stack">
      <PageHeader kicker="Admin" title="Drops" description="Case-open log from SQLite. Refreshes every few seconds." />
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">When</th>
              <th>User</th>
              <th>Case</th>
              <th>Drop</th>
              <th>Cost</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {opens.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 meta">{timeAgo(Date.parse(row.at))}</td>
                <td className="font-semibold">{row.user}</td>
                <td>{row.caseName}</td>
                <td>
                  {row.skinName}
                  <span className="meta"> · {row.wear.toUpperCase()}</span>
                </td>
                <td className="tabular">{formatMoney(row.costUsd)}</td>
                <td className="tabular">{formatMoney(row.payoutUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!opens.length ? <p className="meta p-3">No opens yet. Unbox a case on the public site.</p> : null}
      </div>
    </div>
  );
}
