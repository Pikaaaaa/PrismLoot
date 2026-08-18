"use client";

import { Badge } from "@/components/ui/Badge";
import { UPGRADE_MAX_CHANCE } from "@/lib/economy/config";
import { formatUpgradeChance } from "@/lib/engine/upgrade";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsUp } from "lucide-react";
import { useId } from "react";

export type UpgradePhase = "idle" | "rolling" | "success" | "fail";
export type UpgradeView = "empty" | "item" | "target" | "ready" | "rolling" | "success" | "fail";

/** Shared viewBox units so ring, well, and pointer stay concentric. */
const VIEW = 240;
const CX = VIEW / 2;
const CY = VIEW / 2;
const TRACK_R = 78;
const TRACK_SW = 14;
const THIN_SW = 3;
const GUIDE_R = 92;
const RING = 2 * Math.PI * TRACK_R;
const TRACK_OUTER = TRACK_R + TRACK_SW / 2;
const WELL_R = 54;
const WELL_INSET = `${((VIEW / 2 - WELL_R) / VIEW) * 100}%`;
/** Inward tick parked at 12 o'clock; CSS rotate carries it around the ring. */
const NEEDLE_TIP_R = TRACK_OUTER - 1;
const NEEDLE_BASE_R = TRACK_OUTER + 10;
const NEEDLE_HALF = 3.5;

function polarCw(r: number, degFrom12Cw: number) {
  const rad = ((degFrom12Cw - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Ease-out quartic: fast laps, then settle on the result. Not ease-in-out (scroll). */
function spinEase(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 4;
}

export function nextSpin(current: number, landAngle: number, turns: number) {
  const currentMod = ((current % 360) + 360) % 360;
  const targetMod = ((landAngle % 360) + 360) % 360;
  const delta = (targetMod - currentMod + 360) % 360;
  return current + 360 * turns + delta;
}

export function landAngleFor(success: boolean, chancePct: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const u = buf[0] / 0x1_0000_0000;
  const capped = Math.min(UPGRADE_MAX_CHANCE, Math.max(0.01, chancePct));
  const arc = (capped / 100) * 360;
  const pad = Math.min(6, Math.max(0.8, arc / 5));
  if (success) return pad + u * Math.max(1, arc - pad * 2);
  return arc + pad + u * Math.max(1, 360 - arc - pad * 2);
}

export function deriveUpgradeView(input: {
  phase: UpgradePhase;
  hasItems: boolean;
  hasTarget: boolean;
  ready: boolean;
}): UpgradeView {
  if (input.phase === "rolling") return "rolling";
  if (input.phase === "success") return "success";
  if (input.phase === "fail") return "fail";
  if (!input.hasItems) return "empty";
  if (!input.hasTarget) return "item";
  if (input.ready) return "ready";
  return "target";
}

function DialLabel({
  deg,
  text,
  anchor = "middle",
}: {
  deg: number;
  text: string;
  anchor?: "start" | "middle" | "end";
}) {
  const p = polarCw(108, deg);
  return (
    <text
      x={p.x}
      y={p.y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fill="var(--color-mute)"
      fontSize="11"
      fontWeight="600"
    >
      {text}
    </text>
  );
}

function GaugeNeedle({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
  return (
    <polygon
      points={`${CX},${CY - NEEDLE_TIP_R} ${CX - NEEDLE_HALF},${CY - NEEDLE_BASE_R} ${CX + NEEDLE_HALF},${CY - NEEDLE_BASE_R}`}
      fill={fill}
      opacity={opacity}
    />
  );
}

export function UpgradeMachine({
  view,
  chance,
  wheelDeg,
  spinMs,
  reduceMotion,
}: {
  view: UpgradeView;
  chance: number;
  wheelDeg: number;
  spinMs: number;
  reduceMotion: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `ugWin-${uid}`;
  const loseId = `ugLose-${uid}`;
  const shownChance = Math.min(UPGRADE_MAX_CHANCE, Math.max(0, chance));
  const rolling = view === "rolling";
  const armed = view === "ready" || view === "rolling" || view === "success" || view === "fail" || view === "target";
  const successLen = armed && shownChance > 0 ? (shownChance / 100) * RING : 0;
  const remainLen = RING - successLen;
  const bound = polarCw(GUIDE_R, (shownChance / 100) * 360);
  const dur = reduceMotion ? 0.01 : rolling ? spinMs / 1000 : 0;
  const ease = rolling && !reduceMotion ? spinEase : "linear";
  const chanceLabel = shownChance > 0 ? formatUpgradeChance(shownChance) : "—";
  const needleFill = view === "fail" ? "var(--color-magenta)" : "var(--color-cyan)";

  return (
    <div
      className={cn(
        "relative mx-auto flex w-[min(100%,15.5rem)] flex-col items-center",
        view === "fail" && "upgrade-fail-pulse",
      )}
    >
      <div className="relative aspect-square w-full">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--color-cyan)" />
              <stop offset="1" stopColor="#7af0d0" />
            </linearGradient>
            <linearGradient id={loseId} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-magenta)" stopOpacity="0.55" />
              <stop offset="1" stopColor="var(--color-danger)" stopOpacity="0.45" />
            </linearGradient>
          </defs>

          <circle
            cx={CX}
            cy={CY}
            r={GUIDE_R}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={view === "empty" ? 1.25 : 1.6}
          />

          {view === "empty" || view === "item" ? (
            <circle
              cx={CX}
              cy={CY}
              r={TRACK_R}
              fill="none"
              stroke={view === "item" ? "var(--color-line-strong)" : "var(--color-line)"}
              strokeWidth={THIN_SW}
              strokeDasharray={view === "empty" ? "5 7" : undefined}
            />
          ) : (
            <g transform={`rotate(-90 ${CX} ${CY})`}>
              {remainLen > 0.01 ? (
                <circle
                  cx={CX}
                  cy={CY}
                  r={TRACK_R}
                  fill="none"
                  stroke={`url(#${loseId})`}
                  strokeWidth={TRACK_SW}
                  strokeDasharray={`${remainLen} ${RING}`}
                  strokeDashoffset={-successLen}
                  strokeLinecap="butt"
                  opacity={view === "success" ? 0.28 : 1}
                />
              ) : null}
              {successLen > 0.01 ? (
                <circle
                  cx={CX}
                  cy={CY}
                  r={TRACK_R}
                  fill="none"
                  stroke={`url(#${gradId})`}
                  strokeWidth={TRACK_SW}
                  strokeDasharray={`${successLen} ${RING}`}
                  strokeLinecap="butt"
                  opacity={view === "fail" ? 0.28 : 1}
                />
              ) : null}
            </g>
          )}

          {armed && shownChance > 0 && shownChance < 100 ? (
            <circle cx={bound.x} cy={bound.y} r="2.2" fill="var(--color-ink)" opacity="0.7" />
          ) : null}

          <DialLabel deg={0} text="0%" />
          <DialLabel deg={180} text="50%" />
          <DialLabel deg={338} text="100%" anchor="end" />
        </svg>

        <motion.div
          className="pointer-events-none absolute inset-0 origin-center will-change-transform"
          animate={{ rotate: wheelDeg }}
          transition={{ duration: dur, ease }}
        >
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="h-full w-full">
            {armed ? (
              <GaugeNeedle fill={needleFill} opacity={rolling ? 1 : 0.92} />
            ) : (
              <GaugeNeedle fill="var(--color-mute)" opacity={0.5} />
            )}
          </svg>
        </motion.div>

        <div
          className={cn(
            "absolute isolate grid place-items-center overflow-hidden rounded-full border bg-void/45 [clip-path:circle(50%)]",
            view === "success" && "border-cyan/50",
            view === "fail" && "border-danger/40",
            view === "empty" && "border-dashed border-line-strong",
            view !== "empty" && view !== "success" && view !== "fail" && "border-line",
          )}
          style={{ inset: WELL_INSET }}
        >
          <AnimatePresence mode="wait">
            {view === "fail" ? (
              <motion.div
                key="fail"
                className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
              >
                <Badge tone="violet">Lost</Badge>
                <p className="font-display text-xs font-bold text-ink">Stake consumed</p>
              </motion.div>
            ) : view === "success" ? (
              <motion.div
                key="success"
                className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
              >
                <Badge tone="accent">Won</Badge>
                <p className="font-display text-lg font-bold tabular text-cyan">{chanceLabel}</p>
              </motion.div>
            ) : showChanceWell(view, shownChance) ? (
              <motion.div
                key={`chance-${view}`}
                className="flex h-full w-full flex-col items-center justify-center px-3 text-center"
                initial={{ opacity: 0.5, scale: 0.94 }}
                animate={{
                  opacity: 1,
                  scale: rolling && !reduceMotion ? [1, 1.03, 1] : 1,
                }}
                transition={{
                  duration: rolling ? 0.7 : reduceMotion ? 0 : 0.22,
                  repeat: rolling && !reduceMotion ? Infinity : 0,
                }}
              >
                <p
                  className={cn(
                    "font-display text-2xl font-bold tabular leading-none",
                    rolling ? "text-cyan" : "text-ink",
                  )}
                >
                  {chanceLabel}
                </p>
                {view === "ready" ? <p className="meta mt-1">Chance</p> : null}
              </motion.div>
            ) : (
              <motion.div
                key={view === "empty" ? "empty" : "wait"}
                className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ChevronsUp className="h-5 w-5 text-mute" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function showChanceWell(view: UpgradeView, shownChance: number) {
  if (!(shownChance > 0)) return false;
  return view === "target" || view === "ready" || view === "rolling";
}
