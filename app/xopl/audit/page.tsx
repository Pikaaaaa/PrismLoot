"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { timeAgo } from "@/lib/utils";
import { useEffect, useState } from "react";

type Log = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  at: string;
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/audit");
      const json = await res.json();
      if (json.ok) setLogs(json.logs ?? []);
    })();
  }, []);

  return (
    <div className="page-stack">
      <PageHeader kicker="Admin" title="Audit log" description="Who changed balances, catalog, bans, and promo codes." />
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 meta">{timeAgo(Date.parse(row.at))}</td>
                <td className="font-semibold">{row.actor}</td>
                <td>{row.action}</td>
                <td className="meta">
                  {row.targetType}
                  {row.targetId ? ` ${row.targetId}` : ""}
                </td>
                <td className="meta">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length ? <p className="meta p-3">No admin actions yet.</p> : null}
      </div>
    </div>
  );
}
