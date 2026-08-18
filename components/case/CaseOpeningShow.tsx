"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { RarityChrome } from "@/components/ui/RarityChrome";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import {
  landingOffset,
  pickBaitOffset,
  spinEase,
  TAPE_LEN,
  WIN_INDEX,
} from "@/lib/case-reveal";
import { RARITY_META } from "@/lib/rarity";
import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import { secureShuffle, secureUnit } from "@/lib/rewards/rng";
import type { InventoryItem, Rarity, Skin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { playReelTick } from "./caseReelAudio";

export function RarityFX({ rarity }: { rarity: Rarity }) {
  const meta = RARITY_META[rarity];
  const level =
    rarity === "common" || rarity === "uncommon"
      ? 0
      : rarity === "rare"
        ? 1
        : rarity === "epic"
          ? 2
          : rarity === "legendary"
            ? 3
            : 4;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {level >= 1 && <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 80px ${meta.glow}` }} />}
      {level >= 2 &&
        Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 19) % 100}%`,
              background: meta.color,
              animation: `floaty ${2 + (i % 3)}s ease-in-out ${i * 0.12}s infinite`,
            }}
          />
        ))}
      {level >= 3 && (
        <div
          className="absolute inset-0 opacity-50"
          style={{ background: `radial-gradient(circle at 50% 40%, ${meta.glow}, transparent 55%)` }}
        />
      )}
      {level >= 4 && <div className="absolute inset-0 bg-void/30" />}
    </div>
  );
}

/** Gold jackpot bloom — only for juiced hits (≥5× on cases > 5000 RUB), not every covert. */
export function JackpotFX() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(228,174,57,0.35), transparent 42%), radial-gradient(circle at 50% 70%, rgba(255,255,255,0.08), transparent 55%)",
        }}
      />
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${8 + ((i * 17) % 84)}%`,
            top: `${12 + ((i * 29) % 70)}%`,
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            background: i % 2 ? "#fde68a" : "#e4ae39",
            boxShadow: "0 0 10px rgba(228,174,57,0.7)",
            animation: `floaty ${1.6 + (i % 4) * 0.35}s ease-in-out ${i * 0.08}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function listingOf(skin: Skin) {
  return getSkinPrice(skin.id).price ?? 0;
}

function pickSister(band: Skin[]) {
  if (!band.length) return undefined;
  return band[Math.floor(secureUnit() * band.length)];
}

function uniqueSister(band: Skin[], used: Set<string>) {
  const free = band.filter((s) => !used.has(s.id));
  return pickSister(free.length ? free : band);
}

/** Shuffle crate pool, then park a varying high/mid sister left and/or right of the winner. */
function buildShuffledTape(pool: Skin[], winner: InventoryItem, baitSign: number) {
  const source = pool.filter((skin) => skin?.id);
  const fillers = source.length ? source : [winner];
  const tape: Skin[] = [];
  while (tape.length < TAPE_LEN) {
    tape.push(...secureShuffle(fillers));
  }
  tape.length = TAPE_LEN;
  tape[WIN_INDEX] = winner;

  if (WIN_INDEX <= 0 || WIN_INDEX >= TAPE_LEN - 1) return tape;

  const ranked = fillers
    .filter((s) => s.id !== winner.id)
    .slice()
    .sort((a, b) => listingOf(b) - listingOf(a));
  if (!ranked.length) return tape;

  const topN = Math.max(2, Math.ceil(ranked.length * 0.28));
  const high = ranked.slice(0, topN);
  const midFrom = Math.floor(ranked.length * 0.22);
  const midTo = Math.max(midFrom + 1, Math.ceil(ranked.length * 0.62));
  const mid = ranked.slice(midFrom, midTo);

  const left = WIN_INDEX - 1;
  const right = WIN_INDEX + 1;
  const lean = baitSign >= 0 ? left : right;
  const other = lean === left ? right : left;
  const used = new Set<string>([winner.id]);
  const roll = secureUnit();

  if (roll < 0.34 && high.length >= 2) {
    const a = uniqueSister(high, used);
    if (a) {
      tape[left] = a;
      used.add(a.id);
    }
    const b = uniqueSister(high, used);
    if (b) tape[right] = b;
  } else if (roll < 0.72) {
    const bait = uniqueSister(high, used);
    if (bait) tape[lean] = bait;
  } else {
    const bait = uniqueSister(mid.length ? mid : ranked, used);
    if (bait) tape[lean] = bait;
    if (secureUnit() < 0.35) {
      used.add(bait?.id ?? "");
      const sister = uniqueSister(high, used);
      if (sister) tape[other] = sister;
    }
  }
  return tape;
}

function ReelCard({
  skin,
  win,
  compact,
  reduceMotion = false,
}: {
  skin: Skin;
  win?: boolean;
  compact?: boolean;
  reduceMotion?: boolean;
}) {
  const meta = RARITY_META[skin.rarity];
  const pulse = Boolean(win && !reduceMotion);
  return (
    <motion.div
      className="box-border flex h-full w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] bg-graphite"
      style={{
        border: win ? `1px solid ${meta.color}` : "1px solid var(--color-line)",
      }}
      animate={
        pulse
          ? {
              boxShadow: [
                `0 0 0 1px ${meta.color}66, 0 0 0px ${meta.color}00`,
                `0 0 0 2px ${meta.color}, 0 0 22px ${meta.color}66`,
                `0 0 0 1px ${meta.color}99, 0 0 12px ${meta.color}44`,
              ],
            }
          : { boxShadow: "0 0 0 0 transparent" }
      }
      transition={pulse ? { duration: 0.9, repeat: 2, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
    >
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <RarityChrome rarity={skin.rarity} />
        <SkinVisual skin={skin} framed={false} chrome={false} showWear={false} pad={0} className="h-full w-full" />
      </div>
      <p className={cn("meta min-w-0 w-full shrink-0 truncate px-2 py-1 text-center text-ink", compact && "py-0.5")}>
        {skin.name}
      </p>
    </motion.div>
  );
}

function Pointer() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-3 justify-center">
        <span className="block h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-cyan" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-3 items-end justify-center">
        <span className="block h-0 w-0 border-x-[5px] border-b-[7px] border-x-transparent border-b-cyan" />
      </div>
      <div className="pointer-events-none absolute inset-y-2 left-1/2 z-10 w-px -translate-x-1/2 bg-cyan/40" />
    </>
  );
}

function EmptyReel() {
  return (
    <div className="grid h-full place-items-center bg-graphite px-3">
      <EmptyState compact title="No items in this crate" detail="This pool has nothing to preview." />
    </div>
  );
}

export function IdleReel({ pool, reduceMotion = false }: { pool: Skin[]; reduceMotion?: boolean }) {
  const strip = pool.slice(0, 14);
  if (!strip.length) return <EmptyReel />;
  return (
    <div className="relative flex h-full items-center overflow-hidden bg-graphite">
      <Pointer />
      <div className={cn("flex h-full gap-3 px-4 py-3", reduceMotion ? null : "animate-[ticker_28s_linear_infinite]")}>
        {strip.concat(strip).map((skin, i) => (
          <div key={`${skin.id}-${i}`} className="h-full w-36 shrink-0">
            <ReelCard skin={skin} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CaseOpeningShow({
  pool,
  winner,
  playing,
  reduceMotion = false,
  settled = false,
  compact = false,
  durationMs = 0,
  sound = false,
}: {
  pool: Skin[];
  winner: InventoryItem;
  playing: boolean;
  reduceMotion?: boolean;
  /** After the reel stops — never during spin (spoiler). */
  settled?: boolean;
  compact?: boolean;
  durationMs?: number;
  sound?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef(0);
  const xRef = useRef(0);
  const baitRef = useRef(0);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const lastIndexRef = useRef(-1);
  const runningRef = useRef(false);

  const poolRef = useRef(pool);
  poolRef.current = pool;

  // Pool identity can change with price ticks; freeze the strip to this roll.
  const tape = useMemo(() => {
    const bait = pickBaitOffset(compact ? 96 : 144, reduceMotion);
    baitRef.current = bait;
    return buildShuffledTape(poolRef.current, winner, Math.sign(bait) || (secureUnit() < 0.5 ? 1 : -1));
  }, [winner.instanceId, compact, reduceMotion, winner]);

  function applyX(x: number) {
    xRef.current = x;
    const el = tapeRef.current;
    if (el) el.style.transform = `translate3d(${x}px,0,0)`;
  }

  function measureLanding() {
    const wrap = wrapRef.current;
    const card = winRef.current;
    if (!wrap || !card) return landingRef.current;
    const wrapW = wrap.clientWidth;
    const winnerCenter = card.offsetLeft + card.offsetWidth / 2;
    const next = landingOffset(wrapW, winnerCenter, reduceMotion ? 0 : baitRef.current);
    landingRef.current = next;
    return next;
  }

  function tickSound(wrapW: number, x: number) {
    if (!sound || reduceMotion) return;
    const row = tapeRef.current;
    const first = row?.firstElementChild as HTMLElement | undefined;
    const second = first?.nextElementSibling as HTMLElement | undefined;
    if (!first || !second) return;
    const stride = second.offsetLeft - first.offsetLeft;
    if (!(stride > 0)) return;
    const pointerInTape = wrapW / 2 - x;
    const index = Math.floor(pointerInTape / stride);
    if (index !== lastIndexRef.current) {
      lastIndexRef.current = index;
      const progress = durationMs > 0 ? Math.min(1, (performance.now() - startRef.current) / durationMs) : 1;
      playReelTick(0.45 + 0.55 * progress);
    }
  }

  function stopRaf() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    runningRef.current = false;
  }

  function snapToLanding() {
    stopRaf();
    applyX(measureLanding());
  }

  useLayoutEffect(() => {
    const landing = measureLanding();
    if (settled || reduceMotion || !playing) applyX(settled || reduceMotion ? landing : 0);
  }, [tape, compact, settled, reduceMotion, playing, winner.instanceId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const landing = measureLanding();
      if (!runningRef.current) applyX(settled || (reduceMotion && playing) ? landing : xRef.current);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [settled, reduceMotion, playing, tape]);

  useEffect(() => {
    if (settled) snapToLanding();
  }, [settled]);

  useEffect(() => {
    if (!playing) {
      stopRaf();
      return;
    }
    if (reduceMotion || durationMs <= 0) {
      snapToLanding();
      return;
    }

    stopRaf();
    measureLanding();
    const from = 0;
    applyX(from);
    startRef.current = performance.now();
    lastIndexRef.current = -1;
    runningRef.current = true;

    const frame = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const p = spinEase(t);
      const landing = landingRef.current;
      const x = from + (landing - from) * p;
      applyX(x);
      const wrap = wrapRef.current;
      if (wrap) tickSound(wrap.clientWidth, x);
      if (t < 1 && runningRef.current) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        runningRef.current = false;
        applyX(landingRef.current);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => stopRaf();
  }, [playing, durationMs, reduceMotion, winner.instanceId]);

  if (!pool.length && !winner?.id) return <EmptyReel />;

  return (
    <div ref={wrapRef} className="relative h-full min-w-0 overflow-hidden bg-graphite">
      <Pointer />
      <div className="flex h-full items-center overflow-hidden py-3">
        <div
          ref={tapeRef}
          className="relative flex h-full will-change-transform"
          style={{ gap: compact ? "0.5rem" : "0.75rem", paddingLeft: "1rem", paddingRight: "1rem" }}
        >
          {tape.map((skin, i) => (
            <div
              key={`${skin.id}-${i}-${winner.instanceId}`}
              ref={i === WIN_INDEX ? winRef : undefined}
              className={cn("box-border h-full min-w-0 shrink-0", compact ? "w-full max-w-24" : "w-36")}
            >
              <ReelCard skin={skin} win={settled && i === WIN_INDEX} compact={compact} reduceMotion={reduceMotion} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
