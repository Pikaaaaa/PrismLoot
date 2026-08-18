"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatQuotePrice } from "@/lib/services/prices/priceProvider";
import { formatMoney } from "@/lib/utils";
import type { PriceDebug, PriceHistory } from "@/lib/types";
import { useEffect, useState } from "react";

function ts(value: number | null) {
  if (!value) return "—";
  return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function PriceLab() {
  const [rows, setRows] = useState<PriceDebug[]>([]);
  const [debug, setDebug] = useState<PriceDebug | null>(null);
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch("/api/admin/prices");
    const data = (await res.json()) as { ok: boolean; rows?: PriceDebug[] };
    if (data.ok && data.rows) setRows(data.rows);
  }

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/admin/prices", { signal: ac.signal })
      .then((res) => res.json())
      .then((data: { ok: boolean; rows?: PriceDebug[] }) => {
        if (data.ok && data.rows) setRows(data.rows);
      })
      .catch(() => {
        /* keep empty table */
      });
    return () => ac.abort();
  }, []);

  async function inspect(skinId: string) {
    const res = await fetch(`/api/admin/prices?skinId=${encodeURIComponent(skinId)}`);
    const data = (await res.json()) as { ok: boolean; debug?: PriceDebug; history?: PriceHistory };
    if (data.debug) setDebug(data.debug);
    if (data.history) setHistory(data.history);
  }

  async function tryLive(skinId: string) {
    const res = await fetch("/api/prices/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skinId, live: true }),
    });
    const data = (await res.json()) as { ok: boolean; live?: boolean; note?: string; error?: string };
    setNote(data.note ?? (data.live ? "Live quote applied" : data.error ?? ""));
    await load();
    await inspect(skinId);
  }

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Developer"
        title="Prices"
        description="Quotes flow External Market API → Price Provider → cache → snapshot. UI never calls Steam itself. Missing quotes show Price unavailable — never $0.00, never random."
      />
      {note ? <p className="surface surface-pad text-sm">{note}</p> : null}
      {debug && (
        <div className="surface surface-pad grid gap-2 text-sm sm:grid-cols-2">
          <p className="sm:col-span-2 font-semibold">Price debug · {debug.name ?? debug.skinId}</p>
          <p>Skin ID: {debug.skinId}</p>
          <p>Market Price: {debug.available && debug.marketPrice != null ? formatMoney(debug.marketPrice) : "Price unavailable"}</p>
          <p>Source: {debug.sourceLabel} ({debug.source})</p>
          <p>Fetched At: {ts(debug.fetchedAt)}</p>
          <p>Cached At: {ts(debug.cachedAt)}</p>
          <p>Expires At: {ts(debug.expiresAt)}</p>
          <p>Currency: {debug.currency}</p>
          <p>
            24H change:{" "}
            {debug.change24h == null ? "Insufficient history" : `${debug.change24h > 0 ? "+" : ""}${debug.change24h}%`}
          </p>
          {history && (
            <p className="sm:col-span-2 text-mute">
              History points: {history.points.length}
              {history.insufficient ? " · Insufficient history" : ""}
            </p>
          )}
          <Button size="sm" variant="ghost" onClick={() => void tryLive(debug.skinId)}>
            Try live Steam quote
          </Button>
        </div>
      )}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">Skin</th>
              <th>Market Price</th>
              <th>Previous</th>
              <th>24H</th>
              <th>Source</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.skinId} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => void inspect(r.skinId)}>
                <td className="p-3 font-semibold">{r.name ?? r.skinId}</td>
                <td>
                  {r.available && r.marketPrice != null
                    ? formatQuotePrice({
                        skinId: r.skinId,
                        available: true,
                        price: r.marketPrice,
                        currency: r.currency,
                        source: "cache",
                        sourceLabel: r.sourceLabel,
                        fetchedAt: r.fetchedAt,
                        expiresAt: r.expiresAt,
                        updatedAt: r.fetchedAt,
                      })
                    : "Price unavailable"}
                </td>
                <td>{r.previousPrice != null ? formatMoney(r.previousPrice) : "—"}</td>
                <td>{r.change24h == null ? "—" : `${r.change24h > 0 ? "+" : ""}${r.change24h}%`}</td>
                <td>{r.sourceLabel}</td>
                <td>{ts(r.fetchedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
