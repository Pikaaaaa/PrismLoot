"use client";

import { CaseGrid } from "@/components/case/CaseCard";
import { CASE_CATEGORIES, categorySort, inCaseCategory, newestCrateAt, type CaseCategory } from "@/components/home/categories";
import { HomeHero } from "@/components/home/HomeHero";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip, FilterRow } from "@/components/ui/FilterBar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CASES } from "@/lib/mock-data";
import { sortCases, uniqueCrates } from "@/lib/ui/catalog";
import { PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";

export function HomeCatalog() {
  const [category, setCategory] = useState<CaseCategory>("all");
  const newestAt = useMemo(() => newestCrateAt(CASES), []);
  const activeLabel = CASE_CATEGORIES.find((chip) => chip.id === category)?.label ?? "Cases";

  const matching = useMemo(
    () =>
      sortCases(
        uniqueCrates(CASES.filter((crate) => inCaseCategory(crate, category, newestAt))),
        categorySort(category),
      ),
    [category, newestAt],
  );

  return (
    <div className="page-stack">
      <HomeHero />
      <PromoBanner />

      <section id="cases" className="section-stack">
        <SectionHeading
          title={category === "all" ? "Cases" : activeLabel}
          count={matching.length}
          description="Every crate shows its full drop table and odds before you spend anything."
        />
        <FilterRow>
          {CASE_CATEGORIES.map((chip) => (
            <FilterChip
              key={chip.id}
              active={category === chip.id}
              onClick={() => setCategory(chip.id)}
              className="uppercase tracking-wider"
            >
              {chip.label}
            </FilterChip>
          ))}
        </FilterRow>
        {matching.length ? (
          <CaseGrid crates={matching} />
        ) : (
          <EmptyState
            icon={<PackageSearch />}
            title="No cases in this category"
            detail="Nothing matches that price band yet — try another category."
            action={
              <Button size="sm" variant="ghost" onClick={() => setCategory("all")}>
                Show all cases
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
