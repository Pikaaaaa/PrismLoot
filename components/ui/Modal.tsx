"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

const WIDTHS = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  size?: keyof typeof WIDTHS;
  /** @deprecated use `size="xl"` */
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent the page behind the dialog from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "glass-strong relative flex max-h-[88vh] w-full min-w-0 flex-col rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)]",
              WIDTHS[wide ? "xl" : size],
            )}
          >
            <button
              onClick={onClose}
              className="absolute right-3.5 top-3.5 z-10 rounded-[var(--radius-xs)] p-1.5 text-mute transition-colors hover:bg-white/10 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {(title || description) && (
              <header className="shrink-0 border-b border-line px-5 py-4 pr-12 sm:px-6">
                {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
                {description && <p className="mt-1 text-xs text-mute">{description}</p>}
              </header>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">{children}</div>

            {footer && (
              <footer className="w-full min-w-0 shrink-0 border-t border-line px-5 py-3.5 sm:px-6">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
