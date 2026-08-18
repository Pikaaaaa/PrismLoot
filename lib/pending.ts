import type { InventoryItem } from "@/lib/types";

export const PENDING_OPENS_KEY = "prismloot-pending-opens-v1";
export const PENDING_UPGRADE_KEY = "prismloot-pending-upgrade-v1";

export type PendingOpen = {
  caseId: string;
  count: number;
  charge: number;
  items: InventoryItem[];
  startedAt: number;
  spinMs: number;
  phase: "spin" | "reveal";
};

export type PendingUpgrade = {
  consumedIds: string[];
  extraStake: number;
  success: boolean;
  chance: number;
  targetSkinId: string;
  targetName: string;
  item: InventoryItem | null;
  sourceNames: string;
  startedAt: number;
  durationMs: number;
  inputValue?: number;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readPendingOpens(): PendingOpen | null {
  const row = readJson<PendingOpen>(PENDING_OPENS_KEY);
  if (!row?.caseId || !Array.isArray(row.items) || !row.items.length) return null;
  return row;
}

export function writePendingOpens(row: PendingOpen) {
  localStorage.setItem(PENDING_OPENS_KEY, JSON.stringify(row));
}

export function clearPendingOpens() {
  localStorage.removeItem(PENDING_OPENS_KEY);
}

export function readPendingUpgrade(): PendingUpgrade | null {
  const row = readJson<PendingUpgrade>(PENDING_UPGRADE_KEY);
  if (!row || !Array.isArray(row.consumedIds) || !row.consumedIds.length) return null;
  return row;
}

export function writePendingUpgrade(row: PendingUpgrade) {
  localStorage.setItem(PENDING_UPGRADE_KEY, JSON.stringify(row));
}

export function clearPendingUpgrade() {
  localStorage.removeItem(PENDING_UPGRADE_KEY);
}
