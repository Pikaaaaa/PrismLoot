import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function FilterChip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold",
        "transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]",
        active
          ? "border-cyan/30 bg-cyan/12 text-cyan"
          : "border-line bg-white/[0.03] text-mute hover:border-line-strong hover:bg-white/[0.06] hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/** Horizontal, scrollable chip row that never causes page overflow. */
export function FilterRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5", className)}>
      {children}
    </div>
  );
}

export function SearchInput({
  className,
  compact,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { compact?: boolean }) {
  return (
    <label
      className={cn(
        "relative flex min-w-0 items-center",
        compact ? "w-full" : "min-w-[10rem] flex-1 sm:max-w-xs",
        className,
      )}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute" />
      <input type="search" className={cn("field pl-8", compact && "h-8 text-xs")} {...props} />
    </label>
  );
}

export function SelectField({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn("field w-auto min-w-[7.5rem] cursor-pointer leading-none", className)} {...props}>
      {children}
    </select>
  );
}
