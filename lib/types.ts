export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic"
  | "ultrarare";

export type Wear = "fn" | "mw" | "ft" | "ww" | "bs";

export type Weapon =
  | "AK-47"
  | "M4A1-S"
  | "M4A4"
  | "AWP"
  | "Glock-18"
  | "USP-S"
  | "Desert Eagle"
  | "P250"
  | "Five-SeveN"
  | "FAMAS"
  | "Galil AR"
  | "SSG 08"
  | "SG 553"
  | "AUG"
  | "MP9"
  | "MAC-10"
  | "MP7"
  | "MP5-SD"
  | "PP-Bizon"
  | "P90"
  | "UMP-45"
  | "XM1014"
  | "MAG-7"
  | "Nova"
  | "Sawed-Off"
  | "Negev"
  | "M249"
  | "SCAR-20"
  | "G3SG1"
  | "Tec-9"
  | "CZ75-Auto"
  | "Dual Berettas"
  | "P2000"
  | "R8 Revolver"
  | "Karambit"
  | "Butterfly Knife"
  | "M9 Bayonet"
  | "Bayonet"
  | "Flip Knife"
  | "Gut Knife"
  | "Falchion Knife"
  | "Bowie Knife"
  | "Huntsman Knife"
  | "Shadow Daggers"
  | "Navaja Knife"
  | "Stiletto Knife"
  | "Talon Knife"
  | "Ursus Knife"
  | "Classic Knife"
  | "Paracord Knife"
  | "Survival Knife"
  | "Nomad Knife"
  | "Skeleton Knife"
  | "Kukri Knife"
  | "Gloves"
  | "Sticker";

export type CaseTag =
  | "popular"
  | "new"
  | "knives"
  | "gloves"
  | "pistols"
  | "rifles"
  | "high-risk"
  | "cheap";

export type CaseSection =
  | "starter"
  | "budget"
  | "standard"
  | "premium"
  | "high-tier"
  | "luxury"
  | "popular"
  | "rifles"
  | "pistols"
  | "awp"
  | "knives"
  | "gloves"
  | "rare"
  | "legendary"
  | "collections"
  | "new";

export type CaseAnimation =
  | "roulette"
  | "vertical"
  | "carousel"
  | "portal"
  | "flip"
  | "break"
  | "core"
  | "rarity-reveal";

export type RtpPreset = "low-risk" | "standard" | "high-risk" | "jackpot";

export type LiveKind = "case" | "upgrade" | "contract" | "battle";

export type LiveAction =
  | "CASE_OPEN"
  | "UPGRADE_SUCCESS"
  | "CONTRACT"
  | "BATTLE_WIN"
  | "TOP_DROP";

export type CurrencyCode = "USD" | "EUR" | "RUB" | "PLN" | "UAH";

export type PriceSource = "snapshot" | "provider" | "cache";

export interface PriceQuote {
  skinId: string;
  wear?: Wear;
  available: boolean;
  price: number | null;
  currency: CurrencyCode;
  source: PriceSource | "unavailable";
  sourceLabel: string;
  fetchedAt: number | null;
  expiresAt: number | null;
  updatedAt: number | null;
}

export interface SkinPriceRow {
  skinId: string;
  wear?: Wear;
  price: number;
  currency: CurrencyCode;
  source: PriceSource;
  sourceLabel: string;
  fetchedAt: number;
  expiresAt: number;
  cachedAt: number;
  previousPrice?: number;
}

export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
}

export interface PriceHistory {
  skinId: string;
  points: PriceHistoryPoint[];
  changePct: number | null;
  range: "24H" | "7D" | "30D" | "90D" | "all";
  insufficient: boolean;
}

export interface PriceDebug {
  skinId: string;
  name?: string;
  marketPrice: number | null;
  previousPrice: number | null;
  change24h: number | null;
  source: string;
  sourceLabel: string;
  fetchedAt: number | null;
  cachedAt: number | null;
  expiresAt: number | null;
  currency: CurrencyCode;
  available: boolean;
}

export interface Skin {
  id: string;
  name: string;
  weapon: Weapon;
  rarity: Rarity;
  wear: Wear;
  /** Catalog snapshot seed only — never display this directly; use PriceProvider. */
  price: number;
  stattrak: boolean;
  colors: string[];
  image?: string;
  collection?: string;
  /** Exteriors that have snapshot quotes. Instantiation only rolls these. */
  availableWears?: Wear[];
  marketPrice?: number;
  currency?: CurrencyCode;
  priceSource?: string;
  priceUpdatedAt?: number;
  updatedAt?: number;
}

/** Tournament sticker finish. Paper commons are intentionally excluded from the curated catalog. */
export type StickerEffect = "Holo" | "Foil" | "Gold" | "Glitter" | "Lenticular" | "Other";

/**
 * Curated high-value tournament sticker (Katowice crown jewels + liquid top tier).
 * Face value is unapplied market; applied contribution uses APPLIED_STICKER_FACTOR.
 */
export interface Sticker {
  id: string;
  name: string;
  marketHashName: string;
  tournament: string;
  year: number;
  team?: string;
  player?: string;
  effect: StickerEffect;
  /** Unapplied face-value USD (Buff/SCM/illiquid mid). */
  price: number;
  currency: CurrencyCode;
  image?: string;
  priceSource: string;
  priceUpdatedAt: number;
}

/** Applied sticker slot on a skin/inventory craft (valuation only — no craft UI required). */
export interface AppliedSticker {
  stickerId: string;
  /** 0 = pristine, 1 = fully scraped. Wear reduces applied contribution. */
  wear?: number;
  slot?: number;
}

/** How an inventory instance left the live vault. The row itself is kept. */
export type InventoryLeftVia = "sell" | "upgrade" | "contract" | "withdraw";

export interface InventoryItem extends Skin {
  instanceId: string;
  obtainedAt: number;
  /** Held by a pending skin withdrawal — still rendered in the vault. */
  withdrawPending?: boolean;
  /** Epoch ms when the item left the live vault (`soldAt` on the row). */
  soldAt?: number | null;
  leftVia?: InventoryLeftVia | null;
  /** Optional applied stickers for craft valuation (PriceProvider base + sticker overlay). */
  stickers?: AppliedSticker[];
}

export interface CaseLoot {
  skinId: string;
  chance: number;
}

export interface CaseReward {
  skinId: string;
  value: number;
  weight: number;
  rarity: Rarity;
  chance: number;
}

export interface Crate {
  id: string;
  name: string;
  description: string;
  price: number;
  tags: CaseTag[];
  section: CaseSection;
  accent: string;
  accent2: string;
  blurb: string;
  image?: string;
  thumbnail?: string;
  background: string;
  theme: string;
  glow: string;
  animationType: CaseAnimation;
  rarityDistribution: Partial<Record<Rarity, number>>;
  popularity: number;
  createdAt: number;
  rtp: number;
  houseEdge: number;
  rtpPreset: RtpPreset;
  rewards: CaseReward[];
  featuredReward: string;
  loot: CaseLoot[];
}

export interface PublicUser {
  id: string;
  username: string;
  avatarHue: number;
  level: number;
  /** Local demo email. Never a Steam password. */
  email?: string | null;
  avatarUrl?: string | null;
  steamId?: string | null;
}

export type AuthProvider = "password" | "steam-openid";

/** Stored live-feed row. Display hydrates user + crate + skin + price from the databases. */
export interface LiveActivityEvent {
  id: string;
  userId: string;
  action: LiveAction;
  caseId: string | null;
  skinId: string;
  timestamp: number;
  battleId?: string;
  totalValue?: number;
}

export interface LiveDrop {
  id: string;
  kind: LiveKind;
  action: LiveAction;
  userId: string;
  user: string;
  avatarHue: number;
  caseId: string | null;
  caseName: string;
  skinId: string;
  skin: Skin;
  price: number;
  isTopDrop: boolean;
  totalValue?: number;
  at: number;
}

export interface BattlePlayer {
  user: PublicUser;
  ready: boolean;
  winnings: InventoryItem[];
  total: number;
}

export interface Battle {
  id: string;
  mode: "1v1" | "2v2" | "3v3" | "ffa";
  status: "waiting" | "live" | "finished";
  cost: number;
  caseIds: string[];
  slots: number;
  players: BattlePlayer[];
  winnerId?: string;
}

export type BattleMode = Battle["mode"];
export type BattleStatus = Battle["status"];

export interface HistoryEntry {
  id: string;
  kind: "open" | "sell" | "upgrade" | "contract" | "battle" | "deposit" | "giveaway" | "withdraw";
  title: string;
  detail: string;
  amount: number;
  at: number;
  itemName?: string;
  sourceName?: string;
  targetName?: string;
  chance?: number;
  result?: "success" | "fail" | "win" | "loss";
}

export interface ToastItem {
  id: string;
  title: string;
  detail?: string;
  tone: "ok" | "warn" | "err" | "rare";
  href?: string;
  hrefLabel?: string;
}

/** All-time highest-value item ever obtained, kept after sell. */
export interface BestDrop {
  skinId: string;
  wear: Wear;
  /** Set when the pull is still (or was) a vault instance. */
  instanceId?: string;
  snapshot: {
    name: string;
    image?: string;
    rarity: Rarity;
    weapon: Weapon;
  };
  valueUsd: number;
  obtainedAt: number;
}

export interface UserStats {
  openedCases: number;
  battles: number;
  upgrades: number;
  contracts: number;
  /** Cash spent on cases + upgrade extras. Server aggregate, not the session log. */
  wageredUsd: number;
  upgradesWon: number;
  upgradesLost: number;
  biggestWin: { name: string; price: number };
  /** Highest market quote of anything ever pulled — not current vault max. */
  bestDrop: BestDrop | null;
  /** One-time hydrate merge of inventory + history into `bestDrop`. */
  bestDropBackfilled?: boolean;
}

export interface RolledCaseReward {
  caseId: string;
  skinId: string;
  chance: number;
  value: number;
  rarity: Rarity;
  item: InventoryItem;
}

export interface CaseEconomyStats {
  caseId: string;
  opens: number;
  revenue: number;
  payout: number;
}
