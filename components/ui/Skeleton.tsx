import { cn } from "@/lib/utils";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Placeholder matching the proportions of a CaseCard. */
export function CaseCardSkeleton() {
  return (
    <div className="surface overflow-hidden">
      <Skeleton className="aspect-[5/4] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

/** Placeholder matching the proportions of a SkinCard. */
export function SkinCardSkeleton() {
  return (
    <div className="surface overflow-hidden">
      <Skeleton className="h-[5.5rem] w-full rounded-none" />
      <div className="space-y-2 p-2.5">
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function CaseGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="case-grid">
      {Array.from({ length: count }).map((_, i) => (
        <CaseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SkinGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="skin-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkinCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="page-stack">
      <Skeleton className="h-40 w-full rounded-[var(--radius-xl)]" />
      <div className="section-stack">
        <Skeleton className="h-5 w-40" />
        <CaseGridSkeleton count={10} />
      </div>
    </div>
  );
}
