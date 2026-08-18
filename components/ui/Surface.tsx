import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Surface({
  className,
  raised,
  ...props
}: HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return <div className={cn(raised ? "surface-raised" : "surface", "rounded-[var(--radius-lg)]", className)} {...props} />;
}
