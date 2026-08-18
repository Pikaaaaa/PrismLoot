"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { demoFairnessTicket } from "@/lib/fairness";
import { useEffect, useState } from "react";

export default function FairnessPage() {
  const [hash, setHash] = useState<string>("");
  const ticket = demoFairnessTicket();

  useEffect(() => {
    void import("@/lib/fairness").then(async (mod) => {
      const sample = await mod.sha256Hex("PRISMLOOT_FAIRNESS_ARCHITECTURE_SEED_V1");
      setHash(sample);
    });
  }, []);

  return (
    <div className="page-stack mx-auto max-w-3xl">
      <PageHeader
        kicker="Transparency"
        title="Fairness"
        description="The server rolls the result, then the UI animates to that winner. Commit-reveal architecture is documented here for when a live backend publishes seeds."
      />

      <section className="surface surface-pad section-stack">
        <SectionHeading title="How a round is meant to work" />
        <ol className="list-decimal space-y-2 pl-4 text-sm text-mute marker:text-cyan">
          <li>Server keeps a secret server seed and publishes only its SHA-256 hash before play.</li>
          <li>Your client seed (or session id) plus a nonce mix into the roll.</li>
          <li>After the round, the server seed can be revealed so anyone can re-hash and compare.</li>
        </ol>
      </section>

      <section className="surface surface-pad section-stack">
        <SectionHeading title="Round ticket" />
        <dl className="grid gap-3">
          <TicketRow label="Server seed hash" value={hash || ticket.serverSeedHash} />
          <TicketRow label="Client seed" value={ticket.clientSeed} />
          <TicketRow label="Nonce" value={String(ticket.nonce)} />
        </dl>
        <p className="text-xs leading-relaxed text-mute">
          Sample hash of <span className="font-mono text-soft">PRISMLOOT_FAIRNESS_ARCHITECTURE_SEED_V1</span> — not
          used to settle live money. Upgrade chance comes from UpgradeEngine independently.
        </p>
      </section>
    </div>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-inset px-3 py-2.5">
      <dt className="label">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-soft">{value}</dd>
    </div>
  );
}
