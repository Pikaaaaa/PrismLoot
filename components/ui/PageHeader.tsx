import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** The single h1 of a page, plus optional kicker, description and actions. */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        {kicker ? <p className="label mb-1.5">{kicker}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-mute">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
