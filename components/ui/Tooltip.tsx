"use client";

import { cn } from "@/lib/utils";
import { useId, useState, type ReactNode } from "react";

export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [show, setShow] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-describedby={show ? id : undefined}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "glass-strong pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-xs)] px-2 py-1 text-xs font-medium text-ink shadow-[var(--shadow-md)]",
          "transition-[opacity,transform] duration-[var(--dur-fast)] ease-[var(--ease)]",
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
          show
            ? "opacity-100 translate-y-0"
            : cn("opacity-0", side === "top" ? "translate-y-1" : "-translate-y-1"),
        )}
      >
        {label}
      </span>
    </span>
  );
}
