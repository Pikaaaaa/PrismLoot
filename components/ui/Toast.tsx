"use client";

import { useAppStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Gem, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";

const TONES = {
  ok: { icon: CheckCircle2, color: "text-cyan", rail: "bg-cyan" },
  warn: { icon: Info, color: "text-amber", rail: "bg-amber" },
  err: { icon: TriangleAlert, color: "text-danger", rail: "bg-danger" },
  rare: { icon: Gem, color: "text-magenta", rail: "bg-magenta" },
} as const;

export function Toast() {
  const { toasts } = useAppStore();

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-3 top-[calc(var(--header-h)+0.75rem)] z-[200] flex w-[min(92vw,22rem)] flex-col items-stretch gap-2 sm:right-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const tone = TONES[(t.tone ?? "ok") as keyof typeof TONES] ?? TONES.ok;
          const Icon = tone.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ x: 24, opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 24, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="glass-strong pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-[var(--radius-md)] py-3 pl-4 pr-4 shadow-[var(--shadow-lg)]"
            >
              <span className={`absolute inset-y-0 left-0 w-[3px] ${tone.rail}`} aria-hidden />
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.color}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{t.title}</p>
                {t.detail ? <p className="mt-0.5 text-xs leading-snug text-mute">{t.detail}</p> : null}
                {t.href ? (
                  <Link href={t.href} className="mt-1 inline-block text-xs font-semibold text-cyan hover:brightness-110">
                    {t.hrefLabel ?? t.href}
                  </Link>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
