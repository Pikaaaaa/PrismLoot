import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-7 w-7 rounded-[var(--radius-xs)] text-[0.625rem]",
  sm: "h-8 w-8 rounded-[var(--radius-sm)] text-[0.6875rem]",
  md: "h-10 w-10 rounded-[var(--radius-sm)] text-[0.8125rem]",
  lg: "h-14 w-14 rounded-[var(--radius-md)] text-base",
  xl: "h-24 w-24 rounded-[var(--radius-lg)] text-3xl",
} as const;

export function UserAvatar({
  name,
  hue,
  size = "md",
  level,
  className,
}: {
  name: string;
  hue: number;
  size?: keyof typeof SIZES;
  level?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "grid place-items-center font-display font-bold text-white ring-1 ring-white/10",
          SIZES[size],
        )}
        style={{
          background: `linear-gradient(145deg, hsl(${hue} 80% 48%), hsl(${(hue + 48) % 360} 85% 28%))`,
        }}
      >
        {initials}
      </div>
      {level != null && (
        <span className="absolute -bottom-1 -right-1 rounded-[var(--radius-xs)] bg-void px-1 text-[0.625rem] font-bold leading-[1.4] tabular-nums text-soft ring-1 ring-line-strong">
          {level}
        </span>
      )}
    </div>
  );
}
