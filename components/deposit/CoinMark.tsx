"use client";

import { useState } from "react";

const SLUG: Record<string, string> = {
  USDT: "usdt",
  BTC: "btc",
  TRX: "trx",
  LTC: "ltc",
  ETH: "eth",
  USDC: "usdc",
};

export function CoinMark({
  ticker,
  color,
  className,
}: {
  ticker: string;
  color: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const slug = SLUG[ticker.toUpperCase()];
  const letter = ticker.slice(0, 1);

  if (slug && !failed) {
    return (
      <img
        src={`/assets/crypto/${slug}.svg`}
        alt=""
        width={36}
        height={36}
        className={className ?? "h-9 w-9 shrink-0"}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        display: "grid",
        placeItems: "center",
        width: "2.25rem",
        height: "2.25rem",
        borderRadius: "999px",
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        fontSize: "0.75rem",
        fontWeight: 800,
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
