/** Preset playthrough multipliers shown as chips on /admin/gift-cards. 0 = no wager. */
export const WAGER_PRESETS = [0, 1, 5, 10, 15, 20, 25, 50] as const;

export const DEFAULT_WAGER_MULTIPLIER = 10;

export function clampWagerMultiplier(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_WAGER_MULTIPLIER;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function formatWagerMultiplier(multiplier: number) {
  if (!(multiplier > 0)) return "None";
  const n = Number.isInteger(multiplier) ? String(multiplier) : multiplier.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `x${n}`;
}
