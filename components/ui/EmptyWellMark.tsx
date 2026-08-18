import { cn } from "@/lib/utils";

/** Centered site wordmark for an empty drop well — no art, no plus, no copy mural. */
export function EmptyWellMark({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid h-full w-full place-items-center", className)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none select-none whitespace-nowrap font-display font-semibold tracking-tight text-ink/20",
          compact ? "text-[length:var(--type-micro)]" : "text-sm",
        )}
      >
        PrismLoot
      </span>
    </div>
  );
}
