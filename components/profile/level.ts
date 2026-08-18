import type { UserStats } from "@/lib/types";

export type LevelProgress = {
  level: number;
  xp: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans. */
  span: number;
  percent: number;
};

const MAX_LEVEL = 999;

/** XP needed to reach a level. Growth is quadratic so late levels cost more. */
function xpForLevel(level: number) {
  return 9 * (level - 1) ** 2;
}

/**
 * Deterministic demo level from what the account actually did plus what it
 * holds. No randomness and no server call, so it never flickers on reload.
 */
export function deriveLevel(stats: UserStats, inventoryValue: number): LevelProgress {
  const xp = Math.max(
    0,
    Math.round(
      stats.openedCases * 12 +
        stats.upgrades * 8 +
        stats.contracts * 10 +
        stats.battles * 15 +
        Math.max(0, inventoryValue) / 4,
    ),
  );
  const level = Math.min(MAX_LEVEL, Math.floor(Math.sqrt(xp) / 3) + 1);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - floor);
  const into = Math.min(span, Math.max(0, xp - floor));
  return { level, xp, into, span, percent: Math.round((into / span) * 100) };
}
