import { PageHeader } from "@/components/ui/PageHeader";

export default function TermsPage() {
  return (
    <div className="page-stack mx-auto max-w-3xl">
      <PageHeader
        kicker="Legal"
        title="Terms of use"
        description="PrismLoot is operated by TRS infinity."
      />
      <article className="surface surface-pad space-y-4 text-sm leading-relaxed text-soft">
        <p>
          This website, including PrismLoot, is owned and operated by <strong className="text-ink">TRS infinity</strong>.
          By using the site you agree to these terms.
        </p>
        <p>
          PrismLoot offers case opening, upgrades, contracts and a site wallet. It does not
          offer withdrawals to Steam or live cryptocurrency processing at this time. Balances
          and inventory have no cash value until a live payout product is launched.
        </p>
        <p>
          Crypto deposit addresses shown in the cashier are operator-controlled placeholders until
          processing is connected. Do not send main-net assets unless the cashier says otherwise.
          TRS infinity will not credit, refund, or recover transfers sent in error.
        </p>
        <p>
          You must be 18 or older. We may suspend access, including by ban, at the operator’s discretion.
          CS2 item names are used under fair reference. This project is not affiliated with Valve.
        </p>
        <p>
          For questions about the operator, see{" "}
          <a href="https://trsinfinity.ink" className="text-cyan hover:underline" rel="noreferrer" target="_blank">
            trsinfinity.ink
          </a>{" "}
          or the Support form.
        </p>
      </article>
    </div>
  );
}
