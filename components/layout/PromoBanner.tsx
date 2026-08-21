"use client";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useState } from "react";

export const DEMO_PROMO_CODE = "PRISM-18";

type ActivePromo = {
  code: string;
  percentBonus: number;
  endsAt: string;
};

function splitHMS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    h: String(Math.floor(total / 3600)).padStart(2, "0"),
    m: String(Math.floor((total % 3600) / 60)).padStart(2, "0"),
    s: String(total % 60).padStart(2, "0"),
  };
}

function Segment({ value, label }: { value: string; label: string }) {
  return (
    <div className="promo-seg">
      <span className="promo-seg-value">{value}</span>
      <span className="promo-seg-label">{label}</span>
    </div>
  );
}

export function PromoBanner({ className }: { className?: string }) {
  const { savePromo, savedPromo } = useAppStore();
  const [promo, setPromo] = useState<ActivePromo | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/promo/current");
        const json = (await res.json()) as {
          ok?: boolean;
          enabled?: boolean;
          code?: string;
          percentBonus?: number;
          endsAt?: string;
        };
        if (cancelled || !json.ok || !json.enabled || !json.code || !json.endsAt) {
          if (!cancelled) setPromo(null);
          return;
        }
        setPromo({
          code: json.code,
          percentBonus: json.percentBonus ?? 0,
          endsAt: json.endsAt,
        });
      } catch {
        if (!cancelled) setPromo(null);
      }
    }
    void load();
    const refresh = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (!promo) return;
    const end = Date.parse(promo.endsAt);
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [promo]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!promo) return null;

  const applied = savedPromo === promo.code;

  async function applyPromo() {
    const active = promo;
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
    } catch {
      /* clipboard may be blocked — the code is still applied below */
    }
    await savePromo(active.code);
  }

  const { h, m, s } = splitHMS(remaining);

  return (
    <section className={cn("promo-bar", className)} aria-label="Deposit bonus promotion">
      <div className="promo-offer">
        <span className="promo-mark" aria-hidden>
          <Gift className="h-[1.125rem] w-[1.125rem]" />
        </span>
        <div className="min-w-0">
          <p className="promo-value">+{promo.percentBonus}%</p>
          <p className="promo-offer-sub">Bonus to balance</p>
        </div>
      </div>

      <div className="promo-count">
        <p className="promo-count-label">
          <span className="promo-pulse" aria-hidden />
          Ends in
        </p>
        <div className="promo-segs" role="timer" aria-label={`Offer ends in ${h} hours ${m} minutes`}>
          <Segment value={h} label="hrs" />
          <span className="promo-colon" aria-hidden>
            :
          </span>
          <Segment value={m} label="min" />
          <span className="promo-colon" aria-hidden>
            :
          </span>
          <Segment value={s} label="sec" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void applyPromo()}
        className={cn("promo-code", applied && "is-applied")}
        aria-label={`Copy and apply promo code ${promo.code}`}
      >
        <span className="min-w-0">
          <span className="promo-code-label">{applied ? "Applied" : "Promo code"}</span>
          <span className="promo-code-value">{promo.code}</span>
        </span>
        {copied || applied ? (
          <Check className="promo-code-icon h-4 w-4" />
        ) : (
          <Copy className="promo-code-icon h-4 w-4" />
        )}
      </button>
    </section>
  );
}
