import { cn } from "@/lib/utils";
import { RARITY_META } from "@/lib/rarity";
import type { Rarity } from "@/lib/types";
import type { HTMLAttributes, ReactNode } from "react";

const TONES = {
  neutral: "bg-white/[0.06] text-soft border-transparent",
  outline: "bg-transparent text-mute border-line",
  accent: "bg-cyan/12 text-cyan border-cyan/25",
  gold: "bg-gold/12 text-gold border-gold/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  warn: "bg-amber/12 text-amber border-amber/25",
  violet: "bg-magenta/12 text-magenta border-magenta/25",
} as const;

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof TONES;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold leading-tight whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/** Rarity pill that carries the grade colour without shouting. */
export function RarityPill({ rarity, className }: { rarity: Rarity; className?: string }) {
  const meta = RARITY_META[rarity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold leading-tight whitespace-nowrap",
        className,
      )}
      style={{
        color: meta.color,
        borderColor: `${meta.color}40`,
        background: `${meta.color}14`,
      }}
    >
      {meta.label}
    </span>
  );
}
