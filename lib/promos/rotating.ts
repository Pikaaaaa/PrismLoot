import { prisma } from "@/lib/db";

/** 12-hour promo windows. Local/dev only unless PROMO_ROTATION=1. */
export const PROMO_WINDOW_MS = 12 * 60 * 60 * 1000;
const PROMO_EPOCH_MS = Date.UTC(2026, 0, 1);
const ROTATING_NOTE_PREFIX = "rotating:";

export type RotatingPromo = {
  code: string;
  percentBonus: number;
  endsAt: string;
  windowIndex: number;
};

/** Enabled by default on all environments; set PROMO_ROTATION=0 to disable. */
export function promoRotationEnabled() {
  return process.env.PROMO_ROTATION !== "0";
}

export function promoWindowIndex(now = Date.now()) {
  return Math.floor((now - PROMO_EPOCH_MS) / PROMO_WINDOW_MS);
}

export function promoWindowEndsAt(index: number) {
  return PROMO_EPOCH_MS + (index + 1) * PROMO_WINDOW_MS;
}

/** Deterministic 15–21% for a window index. */
export function percentForWindow(index: number) {
  let h = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return 15 + (Math.abs(h) % 7);
}

export function codeForPercent(percent: number) {
  return `PRISM-${percent}`;
}

export function bonusPercentFromCode(code: string | null | undefined) {
  if (!code) return null;
  const match = code.trim().toUpperCase().match(/-(\d{2})$/);
  if (!match) return null;
  const pct = Number(match[1]);
  return pct >= 15 && pct <= 21 ? pct : null;
}

export function currentRotatingPromo(now = Date.now()): RotatingPromo {
  const windowIndex = promoWindowIndex(now);
  const percentBonus = percentForWindow(windowIndex);
  return {
    code: codeForPercent(percentBonus),
    percentBonus,
    endsAt: new Date(promoWindowEndsAt(windowIndex)).toISOString(),
    windowIndex,
  };
}

/** Upsert the active window code and retire older rotation codes. */
export async function ensureRotatingPromo(now = Date.now()): Promise<RotatingPromo | null> {
  if (!promoRotationEnabled()) return null;

  const active = currentRotatingPromo(now);

  await prisma.promoCode.updateMany({
    where: {
      note: { startsWith: ROTATING_NOTE_PREFIX },
      code: { not: active.code },
    },
    data: { enabled: false },
  });

  await prisma.promoCode.upsert({
    where: { code: active.code },
    create: {
      code: active.code,
      percentBonus: active.percentBonus,
      enabled: true,
      note: `${ROTATING_NOTE_PREFIX}window:${active.windowIndex}`,
    },
    update: {
      percentBonus: active.percentBonus,
      enabled: true,
      note: `${ROTATING_NOTE_PREFIX}window:${active.windowIndex}`,
    },
  });

  await prisma.promoCode.updateMany({
    where: { code: "SOLAR-20" },
    data: { enabled: false },
  });

  return active;
}

export async function resolvePromoCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  if (promoRotationEnabled()) {
    const active = await ensureRotatingPromo();
    if (!active || normalized !== active.code) return null;
  }

  const promo = await prisma.promoCode.findUnique({ where: { code: normalized } });
  if (!promo?.enabled) return null;
  return promo;
}
