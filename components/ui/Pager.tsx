import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BTN =
  "grid h-8 place-items-center rounded-[var(--radius-sm)] border text-xs font-bold transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]";

export function Pager({
  page,
  pageCount,
  onPage,
  className,
}: {
  page: number;
  pageCount: number;
  onPage: (n: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const windowStart = Math.max(0, Math.min(page - 2, pageCount - 5));
  const nums = Array.from({ length: Math.min(5, pageCount) }, (_, i) => windowStart + i);

  return (
    <nav aria-label="Pagination" className={cn("flex shrink-0 items-center justify-center gap-1", className)}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
        className={cn(BTN, "w-8 border-line text-soft hover:border-line-strong hover:text-ink disabled:opacity-30")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? "page" : undefined}
          onClick={() => onPage(n)}
          className={cn(
            BTN,
            "min-w-8 px-2",
            n === page
              ? "border-cyan/30 bg-cyan/12 text-cyan"
              : "border-line text-soft hover:border-line-strong hover:text-ink",
          )}
        >
          {n + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
        className={cn(BTN, "w-8 border-line text-soft hover:border-line-strong hover:text-ink disabled:opacity-30")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
