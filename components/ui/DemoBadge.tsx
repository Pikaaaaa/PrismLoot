import { cn } from "@/lib/utils";

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-xs)] border border-line px-1.5 py-px",
        "text-[0.625rem] font-bold uppercase tracking-[0.1em] text-mute",
        className,
      )}
    >
      Demo
    </span>
  );
}
