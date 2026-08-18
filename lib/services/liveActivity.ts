import { CASES } from "@/data/cases";
import { DEMO_USER_MAP, DEMO_USERS } from "@/data/demo-users";
import { SKIN_MAP } from "@/data/skins";
import { TOP_DROP_THRESHOLD } from "@/lib/economy/config";
import { listingWearFor, formatQuotePrice, getSkinPrice } from "@/lib/services/prices/priceProvider";
import type { CaseSection, Crate, LiveAction, LiveActivityEvent, LiveDrop, LiveKind, Skin } from "@/lib/types";
import { uid } from "@/lib/utils";

const ACTION_KIND: Record<LiveAction, LiveKind> = {
  CASE_OPEN: "case",
  TOP_DROP: "case",
  UPGRADE_SUCCESS: "upgrade",
  CONTRACT: "contract",
  BATTLE_WIN: "battle",
};

export const LIVE_ACTION_LABEL: Record<LiveAction, string> = {
  CASE_OPEN: "CASE OPEN",
  TOP_DROP: "TOP DROP",
  UPGRADE_SUCCESS: "UPGRADE SUCCESS",
  CONTRACT: "CONTRACT",
  BATTLE_WIN: "BATTLE WIN",
};

/** Unique crates only — CASE_MAP aliases would over-weight some pools. */
const LIVE_CASES = CASES;

/**
 * Traffic mix, not catalog uniform. Cheap/mid cases dominate; luxury is a blip
 * so Lore / Gungnir / Fade knives stay scarce in the feed (same as tape odds).
 */
const CASE_SECTION_WEIGHT: Partial<Record<CaseSection, number>> = {
  starter: 40,
  budget: 24,
  standard: 16,
  pistols: 6,
  rifles: 5,
  awp: 2.5,
  collections: 2,
  premium: 5.5,
  gloves: 1.4,
  knives: 1.0,
  "high-tier": 0.9,
  luxury: 0.2,
};

const ACTION_WEIGHT: Array<{ action: LiveAction; weight: number }> = [
  { action: "CASE_OPEN", weight: 78 },
  { action: "UPGRADE_SUCCESS", weight: 8 },
  { action: "CONTRACT", weight: 7 },
  { action: "BATTLE_WIN", weight: 7 },
];

/** Live cards always format via PriceProvider — instance wear, never catalog 0 / stored drop.price. */
export function formatLiveDropPrice(skinId: string, wear?: import("@/lib/types").Wear): string {
  return formatQuotePrice(getSkinPrice(skinId, wear));
}

export function kindToAction(kind: LiveKind | undefined): LiveAction {
  if (kind === "upgrade") return "UPGRADE_SUCCESS";
  if (kind === "contract") return "CONTRACT";
  if (kind === "battle") return "BATTLE_WIN";
  return "CASE_OPEN";
}

export function findUserIdByName(username: string) {
  const hit = Object.values(DEMO_USER_MAP).find((u) => u.username === username);
  return hit?.id ?? DEMO_USERS[0].id;
}

export function findCaseIdByName(name: string) {
  if (!name || name === "Upgrade" || name === "Contract" || name === "Battle") return null;
  const hit = LIVE_CASES.find((c) => c.name === name);
  return hit?.id ?? null;
}

export function resolveLiveEvent(event: LiveActivityEvent): LiveDrop | null {
  const user = DEMO_USER_MAP[event.userId];
  const skin = SKIN_MAP[event.skinId];
  if (!user || !skin?.image) return null;
  const wear = listingWearFor(event.skinId) ?? skin.wear;
  const quote = getSkinPrice(event.skinId, wear);
  if (!quote.available || quote.price == null) return null;
  const crate = event.caseId ? LIVE_CASES.find((c) => c.id === event.caseId) : undefined;
  const isTopDrop = quote.price >= TOP_DROP_THRESHOLD;
  const action: LiveAction =
    isTopDrop && (event.action === "CASE_OPEN" || event.action === "TOP_DROP")
      ? "TOP_DROP"
      : event.action;
  return {
    id: event.id,
    kind: ACTION_KIND[action],
    action,
    userId: user.id,
    user: user.username,
    avatarHue: user.avatarHue,
    caseId: crate?.id ?? event.caseId,
    caseName: crate?.name ?? (action === "BATTLE_WIN" ? "Battle" : action === "CONTRACT" ? "Contract" : action === "UPGRADE_SUCCESS" ? "Upgrade" : ""),
    skinId: skin.id,
    skin: { ...skin, wear },
    price: quote.price,
    isTopDrop,
    totalValue: event.totalValue,
    at: event.timestamp,
  };
}

export function makeLiveEvent(partial: {
  id?: string;
  userId: string;
  action: LiveAction;
  caseId?: string | null;
  skinId: string;
  timestamp?: number;
  battleId?: string;
  totalValue?: number;
}): LiveActivityEvent {
  return {
    id: partial.id ?? uid("ld"),
    userId: partial.userId,
    action: partial.action,
    caseId: partial.caseId ?? null,
    skinId: partial.skinId,
    timestamp: partial.timestamp ?? Date.now(),
    battleId: partial.battleId,
    totalValue: partial.totalValue,
  };
}

export function liveDropFromLegacy(input: {
  kind?: LiveKind;
  action?: LiveAction;
  userId?: string;
  user?: string;
  avatarHue?: number;
  caseId?: string | null;
  caseName?: string;
  skinId?: string;
  skin?: Skin;
  totalValue?: number;
}): LiveDrop | null {
  const skinId = input.skinId ?? input.skin?.id;
  if (!skinId) return null;
  const userId = input.userId ?? (input.user ? findUserIdByName(input.user) : DEMO_USERS[0].id);
  const caseId = input.caseId ?? (input.caseName ? findCaseIdByName(input.caseName) : null);
  const action = input.action ?? kindToAction(input.kind);
  return resolveLiveEvent(
    makeLiveEvent({
      userId,
      action,
      caseId,
      skinId,
      totalValue: input.totalValue,
    }),
  );
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: () => number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  let roll = rng() * (total || 1);
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function pickLiveCrate(rng: () => number): Crate {
  const sections = (Object.entries(CASE_SECTION_WEIGHT) as Array<[CaseSection, number]>).filter(([, w]) => w > 0);
  const section = pickWeighted(sections, ([, w]) => w, rng)[0];
  const pool = LIVE_CASES.filter((c) => c.section === section);
  if (!pool.length) return LIVE_CASES[Math.floor(rng() * LIVE_CASES.length)];
  return pool[Math.floor(rng() * pool.length)];
}

/** Weighted by the crate's `chance` column — never uniform SKINS / uniform rewards. */
function pickRewardSkinId(crate: Crate, rng: () => number): string {
  const rows = crate.rewards.filter((r) => r.chance > 0 && SKIN_MAP[r.skinId]?.image);
  if (!rows.length) return crate.featuredReward;
  return pickWeighted(rows, (r) => r.chance, rng).skinId;
}

export function rollDemoLiveEvent(now = Date.now(), rng: () => number = Math.random): LiveActivityEvent {
  const user = DEMO_USERS[Math.floor(rng() * DEMO_USERS.length)];
  const crate = pickLiveCrate(rng);
  const action = pickWeighted(ACTION_WEIGHT, (row) => row.weight, rng).action;
  const skinId = pickRewardSkinId(crate, rng);
  const quote = getSkinPrice(skinId, listingWearFor(skinId));
  const market = quote.available && quote.price != null ? quote.price : crate.price;
  return makeLiveEvent({
    userId: user.id,
    action,
    caseId: action === "CASE_OPEN" || action === "TOP_DROP" || action === "BATTLE_WIN" ? crate.id : null,
    skinId,
    timestamp: now,
    totalValue: action === "BATTLE_WIN" ? +(market * 2).toFixed(2) : undefined,
  });
}

export function seedLiveEvents(count = 18, now = Date.now()): LiveDrop[] {
  const rng = mulberry32(0x51f0eed);
  const drops: LiveDrop[] = [];
  let i = 0;
  let tops = 0;
  while (drops.length < count && i < count * 24) {
    const event = rollDemoLiveEvent(now - i * 11_000 - (i % 5) * 1700, rng);
    const drop = resolveLiveEvent(event);
    i++;
    if (!drop) continue;
    if (drop.isTopDrop && tops >= 1) continue;
    if (drop.isTopDrop) tops += 1;
    drops.push({ ...drop, id: `ld_seed_${drops.length}` });
  }
  return drops;
}

export function toLiveEvent(drop: LiveDrop): LiveActivityEvent {
  return {
    id: drop.id,
    userId: drop.userId,
    action: drop.action,
    caseId: drop.caseId,
    skinId: drop.skinId,
    timestamp: drop.at,
    totalValue: drop.totalValue,
  };
}

const LIVE_ACTIONS: LiveAction[] = [
  "CASE_OPEN",
  "TOP_DROP",
  "UPGRADE_SUCCESS",
  "CONTRACT",
  "BATTLE_WIN",
];

function isLiveAction(value: unknown): value is LiveAction {
  return typeof value === "string" && (LIVE_ACTIONS as string[]).includes(value);
}

export function parseStoredLiveEvents(raw: unknown): LiveActivityEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: LiveActivityEvent[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const ev = row as Partial<LiveActivityEvent>;
    if (typeof ev.id !== "string" || seen.has(ev.id)) continue;
    if (typeof ev.userId !== "string" || typeof ev.skinId !== "string") continue;
    if (!isLiveAction(ev.action) || typeof ev.timestamp !== "number") continue;
    seen.add(ev.id);
    out.push({
      id: ev.id,
      userId: ev.userId,
      action: ev.action,
      caseId: typeof ev.caseId === "string" ? ev.caseId : null,
      skinId: ev.skinId,
      timestamp: ev.timestamp,
      battleId: typeof ev.battleId === "string" ? ev.battleId : undefined,
      totalValue: typeof ev.totalValue === "number" ? ev.totalValue : undefined,
    });
  }
  return out;
}

/** Re-resolve stored events through PriceProvider. Same ids / skins; live quotes. */
export function reviveLiveDrops(raw: unknown): LiveDrop[] {
  const events = parseStoredLiveEvents(raw);
  const drops: LiveDrop[] = [];
  for (const event of events) {
    const drop = resolveLiveEvent(event);
    if (!drop) continue;
    drops.push({ ...drop, id: event.id, at: event.timestamp });
  }
  const newest = drops.reduce((m, d) => Math.max(m, d.at), 0);
  if (newest && Date.now() - newest > 2 * 60 * 60 * 1000) {
    const shift = Date.now() - newest - 8_000;
    return drops.map((d) => ({ ...d, at: d.at + shift }));
  }
  return drops;
}
