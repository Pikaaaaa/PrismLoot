"use client";

import { Button } from "@/components/ui/Button";
import { FilterChip, FilterRow, SearchInput } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney } from "@/lib/utils";
import { useEffect, useState } from "react";

type CaseRow = {
  id: string;
  name: string;
  priceUsd: number;
  enabled: boolean;
  rtp: number;
  section: string;
  rewards: number;
  opens: number;
};

type SkinRow = {
  id: string;
  name: string;
  weapon: string;
  rarity: string;
  priceUsd: number;
  enabled: boolean;
};

export default function AdminCatalogPage() {
  const [tab, setTab] = useState<"cases" | "skins">("cases");
  const [q, setQ] = useState("");
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [skins, setSkins] = useState<SkinRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/admin/catalog?tab=${tab}&q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!json.ok) return;
        if (tab === "cases") setCases(json.cases ?? []);
        else setSkins(json.skins ?? []);
      })();
    }, 180);
    return () => window.clearTimeout(handle);
  }, [tab, q]);

  async function save(type: "case" | "skin", id: string, extra: Record<string, unknown> = {}) {
    setBusy(id);
    const priceRaw = drafts[id];
    const priceUsd = priceRaw != null && priceRaw !== "" ? Number(priceRaw) : undefined;
    await fetch("/api/admin/catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, priceUsd, ...extra }),
    });
    setBusy(null);
    const res = await fetch(`/api/admin/catalog?tab=${tab}&q=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (tab === "cases") setCases(json.cases ?? []);
    else setSkins(json.skins ?? []);
  }

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Admin"
        title="Catalog"
        description="DB price and enabled flags overlay static data/cases.ts on case-open. Client reels still read the files."
      />
      <FilterRow>
        <FilterChip active={tab === "cases"} onClick={() => setTab("cases")}>
          Cases
        </FilterChip>
        <FilterChip active={tab === "skins"} onClick={() => setTab("skins")}>
          Skins
        </FilterChip>
      </FilterRow>
      <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "cases" ? "Search cases" : "Search skins"} />
      {tab === "cases" ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-graphite text-xs uppercase text-mute">
              <tr>
                <th className="p-3">Case</th>
                <th>Price USD</th>
                <th>RTP</th>
                <th>Opens</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="p-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="meta">{row.id} · {row.rewards} rewards</p>
                  </td>
                  <td>
                    <input
                      className="field w-24"
                      defaultValue={row.priceUsd}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                    />
                  </td>
                  <td className="tabular">{(row.rtp * 100).toFixed(1)}%</td>
                  <td>{row.opens}</td>
                  <td>{row.enabled ? "On" : "Off"}</td>
                  <td>
                    <div className="flex gap-2 p-2">
                      <Button size="xs" loading={busy === row.id} onClick={() => void save("case", row.id)}>
                        Save
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => void save("case", row.id, { enabled: !row.enabled })}
                      >
                        {row.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-graphite text-xs uppercase text-mute">
              <tr>
                <th className="p-3">Skin</th>
                <th>Price USD</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {skins.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="p-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="meta">{row.id} · {row.weapon} · {row.rarity}</p>
                  </td>
                  <td>
                    <input
                      className="field w-24"
                      defaultValue={row.priceUsd}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                    />
                  </td>
                  <td>{row.enabled ? "On" : "Off"}</td>
                  <td>
                    <div className="flex gap-2 p-2">
                      <Button size="xs" loading={busy === row.id} onClick={() => void save("skin", row.id)}>
                        Save
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => void save("skin", row.id, { enabled: !row.enabled })}
                      >
                        {row.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
