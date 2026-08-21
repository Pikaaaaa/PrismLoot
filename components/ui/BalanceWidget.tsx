"use client";

import { cn, formatBalance, formatMoney } from "@/lib/utils";
import { Wallet } from "lucide-react";
import Link from "next/link";

const CLASS =
  "group inline-flex h-8 min-w-0 max-w-[11rem] shrink items-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-graphite px-2 transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease)] hover:border-line-strong hover:bg-hover";

export function BalanceWidget({
  balance,
  wagerRemainingUsd = 0,
  onClick,
  href,
  className,
}: {
  balance: number;
  wagerRemainingUsd?: number;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <Wallet className="h-3.5 w-3.5 shrink-0 text-mute transition-colors duration-[var(--dur-fast)] group-hover:text-cyan" />
      <span className="truncate text-[0.8125rem] font-bold leading-none tabular-nums text-ink">
        {formatBalance(balance)}
      </span>
    </>
  );
  const title =
    wagerRemainingUsd > 0
      ? `Balance ${formatBalance(balance)} · Playthrough ${formatMoney(wagerRemainingUsd)} left`
      : `Balance ${formatBalance(balance)}`;
  const label = `${title}. Deposit`;

  if (href) {
    return (
      <Link href={href} title={title} aria-label={label} className={cn(CLASS, className)}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} title={title} aria-label={label} className={cn(CLASS, className)}>
      {inner}
    </button>
  );
}
