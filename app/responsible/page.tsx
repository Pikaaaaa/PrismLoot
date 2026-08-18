import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export default function ResponsiblePage() {
  return (
    <div className="page-stack mx-auto max-w-3xl">
      <PageHeader
        kicker="Legal"
        title="Responsible play"
        description="18+ only. PrismLoot is operated by TRS infinity."
      />
      <article className="surface surface-pad space-y-4 text-sm leading-relaxed text-soft">
        <p>
          You must be 18 or older to use this site. PrismLoot is skins-site gameplay
          (cases, upgrades, contracts, a site wallet). It is not a substitute for real-world
          gambling support.
        </p>
        <p>
          Treat site balance as play credits. If play stops being fun, take a break. Support
          resources in your region can help if gambling is a problem in real life.
        </p>
        <p>
          Account bans, balance edits, gift cards and deposit approvals are operator tools used by
          TRS infinity on this site.
        </p>
        <p>
          <Link href="/support" className="text-cyan hover:underline">
            Contact support
          </Link>
          {" · "}
          <Link href="/terms" className="text-cyan hover:underline">
            Terms
          </Link>
        </p>
      </article>
    </div>
  );
}
