"use client";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useState } from "react";

export const DEMO_PROMO_CODE = "SOLAR-20";
const PROMO_END_KEY = "prismloot-demo-solar20-end-v2";
const PROMO_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  const { savePromo, savedPromo, toast } = useAppStore();
  const [remaining, setRemaining] = useState(PROMO_WINDOW_MS);
  const [copied, setCopied] = useState(false);
  const applied = savedPromo === DEMO_PROMO_CODE;

  useEffect(() => {
    let end = Number(localStorage.getItem(PROMO_END_KEY));
    if (!Number.isFinite(end) || end <= Date.now()) {
      end = Date.now() + PROMO_WINDOW_MS;
      localStorage.setItem(PROMO_END_KEY, String(end));
    }
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function applyPromo() {
    try {
      await navigator.clipboard.writeText(DEMO_PROMO_CODE);
      setCopied(true);
    } catch {
      /* clipboard may be blocked — the code is still applied below */
    }
    savePromo(DEMO_PROMO_CODE);
    toast({ title: "Promo code applied", detail: `${DEMO_PROMO_CODE} · +20% on your next deposit`, tone: "ok" });
  }

  const { h, m, s } = splitHMS(remaining);

  return (
    <section className={cn("promo-bar", className)} aria-label="Deposit bonus promotion">
      <div className="promo-offer">
        <span className="promo-mark" aria-hidden>
          <Gift className="h-[1.125rem] w-[1.125rem]" />
        </span>
        <div className="min-w-0">
          <p className="promo-value">+20%</p>
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
        aria-label={`Copy and apply promo code ${DEMO_PROMO_CODE}`}
      >
        <span className="min-w-0">
          <span className="promo-code-label">{applied ? "Applied" : "Promo code"}</span>
          <span className="promo-code-value">{DEMO_PROMO_CODE}</span>
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
