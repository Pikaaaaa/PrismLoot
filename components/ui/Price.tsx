import { formatQuotePrice, getSkinPrice } from "@/lib/services/prices/priceProvider";
import type { PriceQuote, Wear } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

export function isDemoQuote(quote: PriceQuote) {
  return quote.source === "snapshot" || quote.source === "cache" || !quote.available;
}

export function Price({
  quote,
  amount,
  className,
}: {
  quote?: PriceQuote;
  amount?: number;
  className?: string;
}) {
  const label = quote ? formatQuotePrice(quote) : amount != null ? formatMoney(amount) : "Price unavailable";
  return (
    <span className={cn("price inline-flex items-baseline gap-1.5", className)}>
      {label}
    </span>
  );
}

export function SkinPrice({
  skinId,
  wear,
  className,
}: {
  skinId: string;
  wear?: Wear;
  className?: string;
}) {
  const quote = getSkinPrice(skinId, wear);
  return <Price quote={quote} className={className} />;
}
