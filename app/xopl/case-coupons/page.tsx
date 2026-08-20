"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SerializedCaseCoupon } from "@/lib/case-coupons/types";
import { formatMoney, timeAgo } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

type CatalogCase = { id: string; name: string; priceUsd: number };
type Filter = "ALL" | "ACTIVE" | "DISABLED" | "EXHAUSTED";

function looksLikeErrorCode(value?: string) {
  return Boolean(value && /^[A-Z][A-Z0-9_]+$/.test(value));
}

function humanAdminError(code?: string) {
  if (!code) return null;
  if (code === "CASE_COUPON_UNAVAILABLE") return "Free-case codes could not be processed. Try again.";
  if (code === "CASE_COUPON_INVALID") return "That code was not found.";
  if (code === "CASE_COUPON_EXISTS") return "That code already exists.";
  if (code === "CASE_NOT_FOUND") return "Pick a case from the catalog.";
  if (code === "INVALID_INPUT") return "Check the form and try again.";
  if (code === "CASE_COUPON_CREATE_FAILED") return "Could not create free-case codes.";
  if (code === "CASE_COUPON_DISABLE_FAILED") return "Could not disable that code.";
  if (code === "UNAUTHORIZED") return "Admin session expired. Sign in again.";
  if (looksLikeErrorCode(code)) return "Something went wrong. Try again.";
  return code;
}

function displayAdminError(json: { message?: string; error?: string }, fallback: string) {
  const mapped = humanAdminError(json.error);
  if (mapped) return mapped;
  if (json.message && !looksLikeErrorCode(json.message)) return json.message;
  return fallback;
}

function rowStatus(row: SerializedCaseCoupon): Filter {
  if (!row.enabled) return "DISABLED";
  if (row.remaining <= 0) return "EXHAUSTED";
  return "ACTIVE";
}

function tone(status: Filter): "accent" | "warn" | "danger" | "outline" {
  if (status === "ACTIVE") return "accent";
  if (status === "EXHAUSTED") return "outline";
  if (status === "DISABLED") return "danger";
  return "warn";
}

export default function AdminCaseCouponsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [rows, setRows] = useState<SerializedCaseCoupon[]>([]);
  const [catalog, setCatalog] = useState<CatalogCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [caseId, setCaseId] = useState("");
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [opens, setOpens] = useState("1");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/case-coupons");
      const json = (await res.json()) as {
        ok?: boolean;
        coupons?: SerializedCaseCoupon[];
        catalog?: CatalogCase[];
        error?: string;
        message?: string;
      };
      if (res.status === 401) {
        setError("Admin session expired. Sign in again.");
        setRows([]);
        return;
      }
      const coupons = Array.isArray(json.coupons) ? json.coupons : [];
      const cases = Array.isArray(json.catalog) ? json.catalog : [];
      setRows(coupons);
      setCatalog(cases);
      setCaseId((current) => current || cases[0]?.id || "");
      if (!res.ok || json.ok === false) {
        setError(displayAdminError(json, "Could not load free-case codes."));
        return;
      }
      setError(null);
    } catch {
      setError("Could not load free-case codes.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === "ALL" ? rows : rows.filter((row) => rowStatus(row) === filter)),
    [filter, rows],
  );

  async function create() {
    setBusy("create");
    setCreated([]);
    try {
      const res = await fetch("/api/admin/case-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          code,
          maxUses: Number(maxUses),
          opensPerRedeem: Number(opens),
          quantity: Number(quantity),
          note,
          expiresAt: expiresAt || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        coupons?: SerializedCaseCoupon[];
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        setError(displayAdminError(json, "Could not create free-case codes."));
        return;
      }
      setCreated((json.coupons ?? []).map((row) => row.code));
      setCode("");
      setNote("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function disable(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/case-coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "DISABLE" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        setError(displayAdminError(json, "Could not disable that code."));
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
        title="Free cases"
        description="Issue a code that grants free opens of one case. Players paste it on Profile → Free case, then open that crate at no charge."
      />

      <div className="surface surface-pad flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-52 flex-1">
            <span className="label">Case</span>
            <select className="field mt-1" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              {catalog.length === 0 ? <option value="">No cases</option> : null}
              {catalog.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {formatMoney(row.priceUsd)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Code (optional)</span>
            <input
              className="field mt-1 w-40 uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FC-XXXX-XXXX"
            />
          </label>
          <label>
            <span className="label">Max uses</span>
            <input className="field mt-1 w-20 tabular" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </label>
          <label>
            <span className="label">Opens each</span>
            <input className="field mt-1 w-20 tabular" value={opens} onChange={(e) => setOpens(e.target.value)} />
          </label>
          <label>
            <span className="label">Quantity</span>
            <input
              className="field mt-1 w-20 tabular"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={Boolean(code.trim())}
            />
          </label>
          <label>
            <span className="label">Expires (optional)</span>
            <input className="field mt-1" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
          <label className="min-w-48 flex-1">
            <span className="label">Note</span>
            <input className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Stream drop, partner, …" />
          </label>
          <Button size="sm" loading={busy === "create"} onClick={() => void create()}>
            Create
          </Button>
        </div>
        <p className="meta">
          Leave code blank to generate FC-XXXX-XXXX. Max uses is how many players can redeem; opens each is how many
          free unboxes they get.
        </p>
      </div>

      {created.length ? (
        <div className="surface surface-pad">
          <p className="label">New codes</p>
          <ul className="mt-2 space-y-1 font-mono text-sm text-cyan">
            {created.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["ALL", "ACTIVE", "DISABLED", "EXHAUSTED"] as const).map((value) => (
          <FilterChip key={value} active={filter === value} onClick={() => setFilter(value)}>
            {value}
          </FilterChip>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-graphite text-xs uppercase text-mute">
            <tr>
              <th className="p-3">Code</th>
              <th>Case</th>
              <th>Opens</th>
              <th>Uses</th>
              <th>Status</th>
              <th>Created</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const status = rowStatus(row);
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="p-3 font-mono text-xs font-semibold">{row.code}</td>
                  <td>{row.caseName}</td>
                  <td className="tabular">{row.opensPerRedeem}</td>
                  <td className="tabular">
                    {row.usedCount} / {row.maxUses}
                    <span className="meta"> · {row.remaining} left</span>
                  </td>
                  <td>
                    <Badge tone={tone(status)}>{status}</Badge>
                  </td>
                  <td className="meta">
                    {timeAgo(Date.parse(row.createdAt))}
                    {row.expiresAt ? ` · exp ${new Date(row.expiresAt).toLocaleDateString()}` : ""}
                  </td>
                  <td className="meta max-w-40 truncate">{row.note || "—"}</td>
                  <td>
                    {row.enabled ? (
                      <Button size="xs" variant="danger" loading={busy === row.id} onClick={() => void disable(row.id)}>
                        Disable
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length ? <EmptyState compact title="No free-case codes yet." detail="Create a code above." /> : null}
      </div>
    </div>
  );
}
