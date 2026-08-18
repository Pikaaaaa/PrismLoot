"use client";

import { useAdminPath } from "@/components/admin/admin-path";
import { consoleHref } from "@/lib/admin/path";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBalance, formatMoney } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  displayName: string;
  role: string;
  banned: boolean;
  balanceUsd: number;
  vaultCount: number;
  opens: number;
  bestDrop: { name: string; priceUsd: number } | null;
};

export default function AdminUsersPage() {
  const basePath = useAdminPath();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
          const json = (await res.json()) as { ok?: boolean; users?: Row[]; error?: string };
          if (!res.ok || !json.ok) {
            setError(json.error ?? "Failed to load");
            return;
          }
          setError(null);
          setRows(json.users ?? []);
        } catch {
          setError("Failed to load");
        }
      })();
    }, 180);
    return () => window.clearTimeout(handle);
  }, [q]);

  return (
    <div className="page-stack">
      <PageHeader kicker="Admin" title="Users" description="Player local-demo (NovaPrime). Search by name or id." />
      <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">User</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Vault</th>
              <th>Opens</th>
              <th>Status</th>
              <th>Best drop</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3">
                  <Link href={consoleHref(basePath, `/users/${row.id}`)} className="font-semibold text-ink hover:text-cyan">
                    {row.displayName}
                  </Link>
                  <p className="meta">{row.id}{row.banned ? " · banned" : ""}</p>
                </td>
                <td className="meta">{row.role}</td>
                <td className="tabular">{formatBalance(row.balanceUsd)}</td>
                <td>{row.vaultCount}</td>
                <td>{row.opens}</td>
                <td>
                  {row.banned ? <Badge tone="danger">Banned</Badge> : <Badge tone="outline">Active</Badge>}
                </td>
                <td>
                  {row.bestDrop ? (
                    <>
                      {row.bestDrop.name}
                      <span className="meta"> · {formatMoney(row.bestDrop.priceUsd)}</span>
                    </>
                  ) : (
                    <span className="meta">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
