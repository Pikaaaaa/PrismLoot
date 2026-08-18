import type { Crate } from "@/lib/types";

/**
 * Marketing categories for the home case catalog. These are
 * intentionally separate from the product lanes in `lib/ui/catalog` — a lane
 * describes what is inside a crate, a category describes who it is for.
 */
export const CASE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "popular", label: "Popular" },
  { id: "low-price", label: "Low price" },
  { id: "high-value", label: "High value" },
  { id: "premium", label: "Premium" },
] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number]["id"];

const DAY_MS = 86_400_000;
const NEW_WINDOW_MS = 21 * DAY_MS;
const POPULAR_MIN = 85;
const LOW_PRICE_MAX = 10;
const HIGH_VALUE_MAX = 250;

/**
 * "New" is anchored to the newest crate in the catalog rather than to
 * `Date.now()`, so the server and the client always agree and the chip never
 * empties out as the demo data ages.
 */
export function newestCrateAt(list: Crate[]) {
  return list.reduce((newest, crate) => Math.max(newest, crate.createdAt), 0);
}

export function inCaseCategory(crate: Crate, category: CaseCategory, newestAt: number) {
  switch (category) {
    case "new":
      return crate.createdAt >= newestAt - NEW_WINDOW_MS;
    case "popular":
      return crate.popularity >= POPULAR_MIN;
    case "low-price":
      return crate.price < LOW_PRICE_MAX;
    case "high-value":
      return crate.price >= LOW_PRICE_MAX && crate.price < HIGH_VALUE_MAX;
    case "premium":
      return crate.price >= HIGH_VALUE_MAX;
    default:
      return true;
  }
}

/** Newest-first reads better for the NEW chip, everything else leads with reach. */
export function categorySort(category: CaseCategory): "popular" | "price" | "new" {
  return category === "new" ? "new" : "popular";
}
