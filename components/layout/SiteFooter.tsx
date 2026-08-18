import Link from "next/link";
import type { ReactNode } from "react";

const PRODUCT = [
  { href: "/", label: "Cases" },
  { href: "/upgrade", label: "Upgrade" },
  { href: "/contracts", label: "Contracts" },
  { href: "/inventory", label: "Vault" },
  { href: "/deposit", label: "Deposit" },
];

const SUPPORT = [
  { href: "/faq", label: "FAQ" },
  { href: "/fairness", label: "Fairness" },
  { href: "/support", label: "Support" },
  { href: "/profile", label: "Account" },
];

const LEGAL = [
  { href: "/terms", label: "Terms of use" },
  { href: "/privacy", label: "Privacy" },
  { href: "/responsible", label: "Responsible play" },
  { href: "/fairness", label: "Provably fair" },
];

const CHIP =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-panel px-2.5 text-[0.6875rem] font-semibold tracking-wide text-mute transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:border-line-strong hover:text-soft";

function Col({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <p className="label mb-3">{title}</p>
      <ul className="flex flex-col gap-2">
        {links.map((item) => (
          <li key={item.href + item.label}>
            <Link
              href={item.href}
              className="text-sm text-soft transition-colors duration-[var(--dur-fast)] hover:text-ink"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarkIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-magenta/85" aria-hidden fill="none">
      {children}
    </svg>
  );
}

function AgeBadge() {
  return (
    <Link
      href="/responsible"
      aria-label="18+ only"
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-danger px-2.5 font-display text-[0.8125rem] font-extrabold tracking-tight text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-opacity duration-[var(--dur-fast)] ease-[var(--ease)] hover:opacity-90"
    >
      18+
    </Link>
  );
}

function CertChip({
  href,
  label,
  title,
  children,
}: {
  href?: string;
  label: string;
  title?: string;
  children: ReactNode;
}) {
  const inner = (
    <>
      <MarkIcon>{children}</MarkIcon>
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={CHIP} title={title}>
        {inner}
      </Link>
    );
  }
  return (
    <span className={CHIP} title={title}>
      {inner}
    </span>
  );
}

function TrustStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <AgeBadge />
        <CertChip href="/fairness" label="Provably Fair" title="Commit-reveal fairness">
          <path
            d="M8 1.6 13.2 3.7v4.15c0 3.02-2.12 5.12-5.2 6.65C4.92 12.97 2.8 10.87 2.8 7.85V3.7L8 1.6Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M5.2 8.15h1.45l.65-1.55.9 3.05 1.05-2.15H10.8"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </CertChip>
        <CertChip href="/fairness" label="Hashed seeds" title="SHA-256 server seed hash">
          <path
            d="M6.15 3.2 5.05 12.8M10.95 3.2 9.85 12.8M3.4 6.3h9.2M3.2 9.7h9.2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </CertChip>
        <CertChip label="SSL Secure" title="Encrypted connection">
          <rect
            x="3.35"
            y="7.2"
            width="9.3"
            height="6.35"
            rx="1.35"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M5.45 7.2V5.45a2.55 2.55 0 0 1 5.1 0V7.2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </CertChip>
        <CertChip href="/responsible" label="Responsible play">
          <circle cx="8" cy="8" r="5.35" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M8 2.65v2.1M8 11.25v2.1M2.65 8h2.1M11.25 8h2.1"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </CertChip>
      </div>
    </div>
  );
}

/**
 * Public-site footer grid. Operator: TRS infinity (logo from the owner's
 * trs-company / trsinfinity.ink brand assets). Not shown on the operator console.
 */
export function SiteFooter({ signedIn = false }: { signedIn?: boolean }) {
  const product = signedIn ? PRODUCT : PRODUCT.filter((item) => item.href === "/");
  const support = signedIn ? SUPPORT : SUPPORT.filter((item) => item.href !== "/profile");

  return (
    <footer className="mt-8 border-t border-line bg-graphite pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.25rem)] lg:pb-10">
      <div className="page-wrap grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-3 bg-transparent">
            <img
              src="/assets/brand/trs-infinity.png"
              alt="TRS infinity"
              width={283}
              height={160}
              className="h-9 w-auto bg-transparent object-contain mix-blend-lighten"
            />
            <span className="min-w-0">
              <span className="block font-display text-sm font-extrabold tracking-tight text-ink">
                TRS infinity
              </span>
              <span className="meta">Site owner</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-soft">
            This website is owned and operated by <strong className="font-semibold text-ink">TRS infinity</strong>.
            PrismLoot is a product of TRS infinity. The operator is the site owner.
          </p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-mute">
            Trust · Reliability · Security. Company presence:{" "}
            <a
              href="https://trsinfinity.ink"
              className="text-cyan hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              trsinfinity.ink
            </a>
          </p>
        </div>

        <Col title="Product" links={product} />
        <Col title="Support" links={support} />
        <Col title="Legal" links={LEGAL} />
      </div>

      <div className="border-t border-line">
        <div className="page-wrap flex flex-col gap-4 py-5">
          <TrustStrip />
          <div className="max-w-3xl space-y-2">
            <p className="text-xs leading-relaxed text-mute">
              © 2026 TRS infinity. All rights reserved. PrismLoot is operated by TRS infinity.
              Case opens, upgrades and contracts are site play — 18+ only.
            </p>
            <p className="text-xs leading-relaxed text-mute">
              Deposit addresses are listed on the cashier. TRS infinity is not a payment processor and does
              not watch the blockchain. Play responsibly.
            </p>
            <p className="text-xs leading-relaxed text-mute">
              CS2 item names are used under fair reference. Not affiliated with Valve Corporation or
              Counter-Strike.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
