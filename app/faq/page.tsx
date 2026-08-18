"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const QA = [
  {
    q: "Is this a real marketplace?",
    a: "PrismLoot is a skins-site product operated by TRS infinity. Balances, rolls and inventories are stored on this site.",
  },
  {
    q: "How do case odds work?",
    a: "Each crate has a visible loot table that sums to 100%. The reel is decorative: the server rolls first, then the tape lands on that skin from this crate’s pool only. Wear is rolled on unbox, not shown on the tape.",
  },
  {
    q: "What happens if an upgrade fails?",
    a: "Stake one or more inventory skins against a catalog target. Success chance is SUM(market prices) ÷ target price, confirmed by the upgrade engine before the wheel spins. Fail consumes the inputs.",
  },
  {
    q: "How do contracts pay out?",
    a: "Like CS2 trade-ups and skin-site contracts, the contract is not guaranteed plus. You stake 3–10 skins; a random reward is drawn from a pool around the input market value with ~92% RTP. Cheap finishes and expensive ones both exist.",
  },
  {
    q: "How are battle winners decided?",
    a: "Every seated player opens the same crate sequence. Highest summed item value wins the pot.",
  },
  {
    q: "Are the skin names official?",
    a: "CS2 item names are used under fair reference. Visuals are original placeholder cards, not game files.",
  },
  {
    q: "Is this provably fair?",
    a: "The /fairness page documents a commit-reveal architecture (server seed hash + client seed). The server rolls the result, then the UI animates to that winner.",
  },
  {
    q: "Can I sign in with Steam?",
    a: "Yes. Use Sign in with Steam in the header. PrismLoot never asks for your Steam password — Steam OpenID only returns your Steam ID and public persona.",
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="page-stack mx-auto max-w-3xl">
      <PageHeader
        kicker="Support"
        title="Frequently asked questions"
        description="How the PrismLoot economy, odds and game modes actually behave."
      />

      <div className="section-stack gap-2">
        {QA.map((item, i) => {
          const expanded = open === i;
          return (
            <div key={item.q} className="surface overflow-hidden">
              <button
                onClick={() => setOpen(expanded ? null : i)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.03]"
              >
                <span className="text-sm font-semibold">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-mute transition-transform duration-[var(--dur)] ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expanded ? (
                <p className="border-t border-line px-4 py-3.5 text-sm leading-relaxed text-mute">
                  {item.a}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
