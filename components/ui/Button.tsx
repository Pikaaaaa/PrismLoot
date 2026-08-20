import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS = {
  /** Main call to action — one per view. */
  primary:
    "bg-cyan text-void shadow-[0_6px_20px_rgba(47,221,176,0.18)] hover:brightness-[1.08] hover:shadow-[0_8px_26px_rgba(47,221,176,0.26)]",
  /** Neutral filled action for secondary flows. */
  secondary: "surface-raised text-ink hover:bg-hover hover:border-line-strong",
  /** Low-emphasis action that sits on a surface. */
  ghost: "border border-line bg-transparent text-ink hover:bg-white/[0.05] hover:border-line-strong",
  /** Bare text action, no chrome until hover. */
  quiet: "bg-transparent text-mute hover:text-ink hover:bg-white/[0.05]",
  gold: "bg-gold text-void hover:brightness-110",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
} as const;

const SIZES = {
  xs: "h-7 gap-1.5 px-2.5 text-[0.75rem] rounded-[var(--radius-xs)]",
  sm: "h-8 gap-1.5 px-3 text-[0.8125rem] rounded-[var(--radius-sm)]",
  md: "h-10 gap-2 px-4 text-sm rounded-[var(--radius-sm)]",
  lg: "h-11 gap-2 px-5 text-sm rounded-[var(--radius-md)]",
  xl: "h-13 gap-2.5 px-7 text-base rounded-[var(--radius-md)]",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  href?: string;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  children,
  href,
  type = "button",
  ...props
}: Props) {
  const classes = cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,filter,transform] duration-[var(--dur-fast)] ease-[var(--ease)]",
    "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40",
    SIZES[size],
    VARIANTS[variant],
    fullWidth && "w-full min-w-0",
    className,
  );
  const inner = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
      {loading ? null : iconRight}
    </>
  );
  if (href && !disabled && !loading) {
    return (
      <a href={href} className={classes}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {inner}
    </button>
  );
}
