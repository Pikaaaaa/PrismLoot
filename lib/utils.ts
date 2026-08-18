import { formatBalance as formatBalanceConverted, formatCompactConverted, formatConverted } from "@/lib/services/prices/currency";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "Price unavailable";
  return formatConverted(value);
}

/** Wallet / balance — always two fraction digits (cents / kopecks). */
export function formatBalance(value: number) {
  if (!Number.isFinite(value)) return "Price unavailable";
  return formatBalanceConverted(value);
}

export function formatCompact(value: number) {
  return formatCompactConverted(value);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Drop odds for UI — 4 decimals on rares (1.2643% / 0.2558% / 0.0264%), never 0.00% for a real drop. */
export function formatDropChance(chance: number) {
  if (!Number.isFinite(chance) || chance <= 0) return "—";
  if (chance >= 10) return `${chance.toFixed(2)}%`;
  return `${chance.toFixed(4)}%`;
}

export function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)];
}

export function weightedPick<T extends { chance: number }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + item.chance, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.chance;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function timeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
