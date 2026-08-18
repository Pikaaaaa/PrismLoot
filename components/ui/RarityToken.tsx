import { RARITY_META } from "@/lib/rarity";
import type { Rarity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RarityToken({
  rarity,
  label = true,
  className,
}: {
  rarity: Rarity;
  label?: boolean;
  className?: string;
}) {
  const meta = RARITY_META[rarity];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {label ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-mute">{meta.label}</span>
      ) : null}
    </span>
  );
}
