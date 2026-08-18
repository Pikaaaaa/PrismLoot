"use client";

import { RarityChrome } from "@/components/ui/RarityChrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { formatLiveDropPrice, LIVE_ACTION_LABEL } from "@/lib/services/liveActivity";
import { useAppStore } from "@/lib/store";
import type { LiveAction, LiveDrop as LiveDropRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";

const MAX_CHIPS = 14;
const SKELETON_CHIPS = 6;

/**
 * Chip geometry is shared with the enter animation: a new row starts with a
 * whole chip of negative margin, so prepending it costs no layout jump.
 */
const CHIP_WIDTH = 320;
const ROW_GAP = 6;
const ENTER_SHIFT = -(CHIP_WIDTH + ROW_GAP);

/** One map for every action cue — a quiet dot plus a label tint, no neon. */
const ACTION_META: Record<LiveAction, { label: string; dot: string; text: string }> = {
  CASE_OPEN: { label: "Case open", dot: "bg-soft/40", text: "" },
  TOP_DROP: { label: "Top drop", dot: "bg-gold", text: "text-gold" },
  UPGRADE_SUCCESS: { label: "Upgrade", dot: "bg-magenta", text: "text-magenta" },
  CONTRACT: { label: "Contract", dot: "bg-cyan", text: "text-cyan" },
  BATTLE_WIN: { label: "Battle", dot: "bg-amber", text: "text-amber" },
};

function relTime(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const DropChip = memo(function DropChip({ drop, now }: { drop: LiveDropRow; now: number }) {
  const action = ACTION_META[drop.action];
  const price = formatLiveDropPrice(drop.skinId, drop.skin.wear);

  return (
    <div
      className="live-chip relative overflow-hidden"
      style={{ width: CHIP_WIDTH }}
      title={`${drop.user} · ${LIVE_ACTION_LABEL[drop.action]} · ${drop.skin.name} · ${price}`}
    >
      <RarityChrome rarity={drop.skin.rarity} edge="left" />

      <UserAvatar name={drop.user} hue={drop.avatarHue} size="xs" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.75rem] font-semibold leading-tight text-ink">{drop.user}</p>
        <p className={cn("label flex items-center gap-1.5 leading-tight", action.text)}>
          <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", action.dot)} />
          <span className="truncate">{action.label}</span>
        </p>
      </div>

      {/* Never an empty black box: SkinVisual falls back to a weapon silhouette. */}
      <div className="relative h-9 w-11 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-graphite">
        <SkinVisual
          skin={drop.skin}
          framed={false}
          chrome={false}
          showWear={false}
          pad={2}
          eager
          className="h-full w-full"
        />
      </div>

      <div className="w-28 shrink-0">
        <p className="truncate text-[0.75rem] font-medium leading-tight text-soft">{drop.skin.name}</p>
        <p className="meta truncate leading-tight">
          <span className="font-bold tabular-nums text-ink">{price}</span> · {relTime(drop.at, now)}
        </p>
      </div>
    </div>
  );
});

function ChipSkeleton() {
  return (
    <div className="live-chip shrink-0" style={{ width: CHIP_WIDTH }} aria-hidden>
      <Skeleton className="h-7 w-7 shrink-0 rounded-[var(--radius-xs)]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2 w-12" />
      </div>
      <Skeleton className="h-9 w-11 shrink-0 rounded-[var(--radius-xs)]" />
      <div className="w-28 shrink-0 space-y-1.5">
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2 w-3/5" />
      </div>
    </div>
  );
}

function RailFrame({ children }: { children: ReactNode }) {
  return (
    <section className="live-rail" aria-label="Live activity">
      <div className="page-wrap flex items-center gap-3 py-1.5">{children}</div>
    </section>
  );
}

function RailCap({ live, pulse }: { live: boolean; pulse: boolean }) {
  return (
    <span className="hidden shrink-0 sm:block">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            live ? "bg-cyan" : "bg-mute",
            live && pulse && "animate-pulse",
          )}
        />
        <span className="label">Live</span>
      </span>
    </span>
  );
}

/** Rail-height notice so the shell never changes height between states. */
function RailNotice({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex h-13 min-w-0 flex-1 items-center gap-2">
      <p className="label truncate">{title}</p>
      {action}
    </div>
  );
}

export function LiveDrop() {
  const { liveDrops, liveFeedOn, reduceMotion, priceTick, hydrated } = useAppStore();
  void priceTick;
  const [now, setNow] = useState(0);

  const chips = useMemo(
    () => liveDrops.filter((drop) => drop.skin).slice(0, MAX_CHIPS),
    [liveDrops],
  );

  // SSR renders "just now"; the real clock starts on the first client frame.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const frame = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, 5000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(id);
    };
  }, []);

  if (!hydrated) {
    return (
      <RailFrame>
        <RailCap live={false} pulse={false} />
        <div className="no-scrollbar flex min-w-0 flex-1 overflow-hidden" style={{ gap: ROW_GAP }}>
          {Array.from({ length: SKELETON_CHIPS }).map((_, index) => (
            <ChipSkeleton key={index} />
          ))}
        </div>
      </RailFrame>
    );
  }

  if (!liveFeedOn) {
    return (
      <RailFrame>
        <RailCap live={false} pulse={false} />
        <RailNotice
          title="Live feed paused"
          action={
            <Link
              href="/settings"
              className="text-[0.75rem] font-semibold text-cyan transition-opacity duration-[var(--dur-fast)] hover:opacity-80"
            >
              Turn it on
            </Link>
          }
        />
      </RailFrame>
    );
  }

  if (!chips.length) {
    return (
      <RailFrame>
        <RailCap live pulse={!reduceMotion} />
        <RailNotice title="Waiting for the first drop" />
      </RailFrame>
    );
  }

  return (
    <RailFrame>
      <RailCap live pulse={!reduceMotion} />
      <div className="relative min-w-0 flex-1">
        <ul
          className="no-scrollbar flex overflow-x-auto overflow-y-hidden"
          style={{ gap: ROW_GAP }}
        >
          <AnimatePresence initial={false}>
            {chips.map((drop) => (
              <motion.li
                key={drop.id}
                className="shrink-0"
                initial={reduceMotion ? false : { opacity: 0, marginLeft: ENTER_SHIFT }}
                animate={{ opacity: 1, marginLeft: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <DropChip drop={drop} now={now} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-void to-transparent"
        />
      </div>
    </RailFrame>
  );
}
