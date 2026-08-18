import fxSnapshot from "@/data/fx-snapshot.json";
import type { CurrencyCode } from "@/lib/types";

const RATES = fxSnapshot.rates as Record<CurrencyCode, number>;

/**
 * Every price in the app is stored in USD. Currency is a presentation concern:
 * nothing is ever persisted per-currency, it is always converted at render time.
 */
let displayCurrency: CurrencyCode = "USD";

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; label: string; locale: string }> = {
  USD: { symbol: "$", label: "US Dollar", locale: "en-US" },
  EUR: { symbol: "€", label: "Euro", locale: "de-DE" },
  RUB: { symbol: "₽", label: "Russian Ruble", locale: "ru-RU" },
  UAH: { symbol: "₴", label: "Ukrainian Hryvnia", locale: "uk-UA" },
  PLN: { symbol: "zł", label: "Polish Złoty", locale: "pl-PL" },
};

export function getDisplayCurrency(): CurrencyCode {
  return displayCurrency;
}

export function setDisplayCurrency(code: CurrencyCode) {
  if (!(code in RATES)) return;
  displayCurrency = code;
}

export function listCurrencies(): Array<{ code: CurrencyCode; rate: number; symbol: string; label: string }> {
  return (Object.keys(RATES) as CurrencyCode[]).map((code) => ({
    code,
    rate: RATES[code],
    symbol: CURRENCY_META[code]?.symbol ?? code,
    label: CURRENCY_META[code]?.label ?? code,
  }));
}

/** USD → display currency. The only conversion entry point. */
export function convertPrice(usd: number, code: CurrencyCode = displayCurrency) {
  const rate = RATES[code] ?? 1;
  return +(usd * rate).toFixed(2);
}

/** @deprecated use {@link convertPrice} */
export const convertFromUsd = convertPrice;

function formatWithFractionDigits(usd: number, code: CurrencyCode, fractionDigits: number) {
  if (!Number.isFinite(usd)) return "Price unavailable";
  const amount = convertPrice(usd, code);
  const meta = CURRENCY_META[code] ?? CURRENCY_META.USD;
  const abs = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const sign = amount < 0 ? "-" : "";
  return code === "PLN" ? `${sign}${abs} ${meta.symbol}` : `${sign}${meta.symbol}${abs}`;
}

/** USD → localized string with the correct currency symbol. */
export function formatCurrency(usd: number, code: CurrencyCode = displayCurrency) {
  if (!Number.isFinite(usd)) return "Price unavailable";
  const amount = convertPrice(usd, code);
  // Grouping is pinned to en-US so server and client render identically.
  // Large catalog prices drop the cents — "₽1,284,000" beats "₽1,284,000.00".
  const fractionDigits = Math.abs(amount) >= 10_000 ? 0 : 2;
  return formatWithFractionDigits(usd, code, fractionDigits);
}

/** Wallet / balance — always cents / kopecks (2 fraction digits). */
export function formatBalance(usd: number, code: CurrencyCode = displayCurrency) {
  return formatWithFractionDigits(usd, code, 2);
}

/** @deprecated use {@link formatCurrency} */
export const formatConverted = formatCurrency;

/** Compact display for big stats ($18.2M), never a raw 1,456,000,000.00 dump. */
export function formatCompactConverted(usd: number, code: CurrencyCode = displayCurrency) {
  if (!Number.isFinite(usd)) return "Price unavailable";
  const amount = convertPrice(usd, code);
  const meta = CURRENCY_META[code] ?? CURRENCY_META.USD;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  let body: string;
  if (abs >= 1_000_000_000) body = `${trimCompact(abs / 1_000_000_000)}B`;
  else if (abs >= 1_000_000) body = `${trimCompact(abs / 1_000_000)}M`;
  else if (abs >= 1_000) body = `${trimCompact(abs / 1_000)}K`;
  else body = abs.toFixed(abs >= 10 ? 0 : 1);
  return code === "PLN" ? `${sign}${body} ${meta.symbol}` : `${sign}${meta.symbol}${body}`;
}

function trimCompact(n: number) {
  const digits = n >= 100 ? 0 : 1;
  return n.toFixed(digits).replace(/\.0$/, "");
}
