import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Heading for a section inside a page. Pages use `PageHeader` for their single
 * h1; every block below it uses this so the scale never drifts per page.
 */
export function SectionHeading({
  title,
  count,
  description,
  actions,
  className,
}: {
  title: string;
  count?: number;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("section-head", className)}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h2>{title}</h2>
          {typeof count === "number" ? (
            <span className="tabular text-xs font-semibold text-mute">{count}</span>
          ) : null}
        </div>
        {description ? <p className="mt-1 text-xs text-mute">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
