"use client";

import { SkinVisual } from "@/components/visuals/SkinVisual";
import { useAppStore } from "@/lib/store";
import type { InventoryItem } from "@/lib/types";
import { Send } from "lucide-react";
import { motion } from "framer-motion";

export function SkinWithdrawSend({ item }: { item: InventoryItem }) {
  const reduceMotion = useAppStore().reduceMotion;
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="Sending skin to Steam"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="relative h-36 w-44 overflow-hidden rounded-[var(--radius-lg)] bg-graphite"
          initial={reduceMotion ? false : { y: 12, opacity: 0.7, scale: 0.96 }}
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { y: [-4, -36, -72], x: [0, 28, 64], opacity: [1, 1, 0], scale: [1, 0.88, 0.55], rotate: [0, 8, 14] }
          }
          transition={reduceMotion ? { duration: 0.2 } : { duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <SkinVisual skin={item} framed={false} chrome={false} showWear={false} pad={12} className="h-full w-full" />
        </motion.div>
        <motion.div
          className="flex items-center gap-2 text-ink"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Send className="h-4 w-4 text-cyan" />
          <p className="text-sm font-semibold">Sending to Steam…</p>
        </motion.div>
        <p className="meta max-w-xs text-center">{item.name}</p>
      </div>
    </div>
  );
}
