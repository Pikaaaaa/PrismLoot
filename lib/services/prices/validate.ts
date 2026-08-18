import type { CurrencyCode, PriceQuote } from "@/lib/types";

const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "RUB", "PLN", "UAH"];

export function isValidCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCIES.includes(value as CurrencyCode);
}

export function isValidMarketPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isValidTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function assertValidQuote(quote: PriceQuote): PriceQuote {
  if (!quote.skinId) throw new Error("INVALID_QUOTE: empty skinId");
  if (quote.available) {
    if (!isValidMarketPrice(quote.price)) throw new Error(`INVALID_QUOTE: bad price for ${quote.skinId}`);
    if (!isValidCurrency(quote.currency)) throw new Error(`INVALID_QUOTE: bad currency for ${quote.skinId}`);
    if (!isValidTimestamp(quote.fetchedAt) || !isValidTimestamp(quote.updatedAt) || !isValidTimestamp(quote.expiresAt)) {
      throw new Error(`INVALID_QUOTE: bad timestamp for ${quote.skinId}`);
    }
  }
  return quote;
}
