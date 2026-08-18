import type { Crate } from "@/lib/types";

/** First occurrence of each `crate.id` wins — home/catalog must never paint the same case twice. */
export function uniqueCrates(list: Crate[]): Crate[] {
  const seen = new Set<string>();
  const out: Crate[] = [];
  for (const crate of list) {
    if (seen.has(crate.id)) continue;
    seen.add(crate.id);
    out.push(crate);
  }
  return out;
}

export const CASE_LANES = [
  { id: "all", label: "All" },
  { id: "starter", label: "Starter" },
  { id: "popular", label: "Popular" },
  { id: "premium", label: "Premium" },
  { id: "high-risk", label: "High Risk" },
  { id: "knives", label: "Knives" },
  { id: "gloves", label: "Gloves" },
  { id: "high-roller", label: "High Roller" },
] as const;

export type CaseLane = (typeof CASE_LANES)[number]["id"];

/** Exclusive lane so a crate is not cloned across dozens of filters. */
export function caseLane(crate: Crate): Exclude<CaseLane, "all"> {
  if (crate.section === "knives" || crate.tags.includes("knives")) return "knives";
  if (crate.section === "gloves" || crate.tags.includes("gloves")) return "gloves";
  if (crate.section === "luxury" || crate.section === "high-tier" || crate.price >= 400) return "high-roller";
  if (crate.tags.includes("high-risk") || crate.rtpPreset === "high-risk") return "high-risk";
  if (crate.section === "starter" || crate.section === "budget" || crate.tags.includes("cheap") || crate.price < 8) {
    return "starter";
  }
  if (crate.tags.includes("popular") || crate.section === "popular" || crate.popularity >= 86) return "popular";
  return "premium";
}

export function sortCases(list: Crate[], sort: "popular" | "price" | "new") {
  return [...list].sort((a, b) => {
    if (sort === "price") return a.price - b.price;
    if (sort === "new") return b.createdAt - a.createdAt;
    const pop = b.popularity - a.popularity;
    if (pop !== 0) return pop;
    return a.price - b.price;
  });
}

export function casesInLane(all: Crate[], lane: CaseLane) {
  if (lane === "all") return uniqueCrates(all);
  return uniqueCrates(all.filter((crate) => caseLane(crate) === lane));
}

/** Homepage rows: one compact strip per product lane, no pill soup. */
export function homeLaneGroups(all: Crate[], perLane = 6) {
  const catalog = uniqueCrates(all);
  return CASE_LANES.filter((lane) => lane.id !== "all")
    .map((lane) => ({
      ...lane,
      cases: sortCases(casesInLane(catalog, lane.id), "popular").slice(0, perLane),
    }))
    .filter((group) => group.cases.length > 0);
}

export const DISPLAY_CURRENCIES = ["USD", "EUR", "RUB", "PLN", "UAH"] as const;

/** @deprecated use CASE_LANES / caseLane */
export const CASE_PAGE_TIERS = CASE_LANES;
export type CasePageTier = CaseLane;
export const caseTier = caseLane;
export function curatedHomeCases(all: Crate[], limit = 9) {
  const picked: Crate[] = [];
  const seen = new Set<string>();
  for (const group of homeLaneGroups(all, 3)) {
    for (const crate of group.cases) {
      if (seen.has(crate.id)) continue;
      seen.add(crate.id);
      picked.push(crate);
      if (picked.length >= limit) return picked;
    }
  }
  return picked;
}
