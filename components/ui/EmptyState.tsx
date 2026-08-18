import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  detail,
  action,
  icon,
  className,
  compact,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** Inline variant for use inside an existing panel. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className={cn("px-3 py-6 text-center", className)}>
        <p className="label">{title}</p>
        {detail ? <p className="mt-1.5 text-xs text-mute">{detail}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("state-block", className)}>
      {icon ? <div className="mb-1 text-mute [&>svg]:h-7 [&>svg]:w-7">{icon}</div> : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {detail ? <p className="max-w-sm text-xs text-mute">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  detail,
  action,
  className,
}: {
  title?: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("state-block border-danger/25 bg-danger/[0.04]", className)}>
      <p className="text-sm font-semibold text-danger">{title}</p>
      {detail ? <p className="max-w-sm text-xs text-mute">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
