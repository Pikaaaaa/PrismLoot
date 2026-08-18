import { PageHeader } from "@/components/ui/PageHeader";

export default function PrivacyPage() {
  return (
    <div className="page-stack mx-auto max-w-3xl">
      <PageHeader
        kicker="Legal"
        title="Privacy"
        description="How PrismLoot, operated by TRS infinity, treats your data."
      />
      <article className="surface surface-pad space-y-4 text-sm leading-relaxed text-soft">
        <p>
          PrismLoot is operated by <strong className="text-ink">TRS infinity</strong>. Play
          state (balance, inventory, settings) is stored in your browser and in the site database.
          Steam login is coming — we do not ask for a Steam password.
        </p>
        <p>
          Optional fields such as a trade URL or email stay on this account unless you submit the
          Support form.
        </p>
        <p>
          Crypto cashier requests record a pending amount, asset and optional note so an administrator can
          approve or reject them. They are not chain transactions until processing is connected.
          Gift-card redemptions are recorded on the ledger.
        </p>
        <p>
          Third-party price quotes and icon files may be loaded from CDNs used by the product. The TRS infinity
          mark is company brand property.
        </p>
      </article>
    </div>
  );
}
