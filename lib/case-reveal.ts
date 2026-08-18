import { convertFromUsd } from "@/lib/services/prices/currency";
import { secureUnit } from "@/lib/rewards/rng";

export const TAPE_LEN = 48;
export const WIN_INDEX = 38;
export const SPIN_MS = 4800;
export const FAST_SPIN_MS = 1600;
/** Keep the pointer inside the winner card, never on the neighbour. */
export const BAIT_EDGE_PAD = 10;
export const BAIT_MIN_FRAC = 0.28;
export const BAIT_MAX_FRAC = 0.42;

/** Case USD > 5000 RUB (same FX as UI) and drop market ≥ 5× case price. Presentation only. */
export function isJuicedHit(casePriceUsd: number, dropUsd: number | null | undefined): boolean {
  if (!(casePriceUsd > 0) || dropUsd == null || !(dropUsd > 0)) return false;
  const rub = convertFromUsd(casePriceUsd, "RUB");
  return rub > 5000 && dropUsd >= casePriceUsd * 5;
}

export function clampBaitOffset(offset: number, cardW: number) {
  const max = Math.max(0, cardW / 2 - BAIT_EDGE_PAD);
  return Math.max(-max, Math.min(max, offset));
}

/** Visual stop only. Winner card still contains the pointer. Reduce-motion → 0. */
export function pickBaitOffset(cardW: number, reduceMotion: boolean) {
  if (reduceMotion || !(cardW > 0)) return 0;
  const mag = cardW * (BAIT_MIN_FRAC + secureUnit() * (BAIT_MAX_FRAC - BAIT_MIN_FRAC));
  const sign = secureUnit() < 0.5 ? 1 : -1;
  return clampBaitOffset(sign * mag, cardW);
}

/**
 * TranslateX that centres the winner card in the well.
 * `winnerCenter` is the card midpoint in the tape's untransformed coordinates.
 */
export function landingOffset(wrapW: number, winnerCenter: number, bait = 0) {
  if (!(wrapW > 0) || !(winnerCenter > 0)) return 0;
  return wrapW / 2 - winnerCenter + bait;
}

export function spinDurationMs(opts: { skip?: boolean; fast?: boolean; reduceMotion?: boolean }) {
  if (opts.skip || opts.reduceMotion) return 0;
  return opts.fast ? FAST_SPIN_MS : SPIN_MS;
}

/**
 * Accelerate through the first beat, then a long ease-out tail.
 * CSS equivalent: cubic-bezier(0.22, 0.02, 0.06, 1).
 */
export function spinEase(t: number): number {
  return cubicBezierEase(0.22, 0.02, 0.06, 1, t);
}

function cubicBezierEase(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const current = sample(x1, x2, t);
    const delta = current - x;
    if (Math.abs(delta) < 1e-5) break;
    const derived = sampleDx(x1, x2, t);
    if (Math.abs(derived) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - delta / derived));
  }
  return sample(y1, y2, t);
}

function sample(a: number, b: number, t: number) {
  const it = 1 - t;
  return 3 * it * it * t * a + 3 * it * t * t * b + t * t * t;
}

function sampleDx(a: number, b: number, t: number) {
  const it = 1 - t;
  return 3 * it * it * a + 6 * it * t * (b - a) + 3 * t * t * (1 - b);
}
