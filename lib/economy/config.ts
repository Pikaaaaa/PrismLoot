/**
 * Per-engine constants. Cases RTP presets, upgrade, and contracts must stay independent.
 * Never mix these numbers across engines.
 */

/** Instant sell pays the market quote. House edge lives in the games, not at checkout. */
export const SELL_COEFFICIENT = 1;

/**
 * Upgrade engine RTP (independent from cases / contracts).
 * Chance = (inputSum / targetPrice) × 100 × UPGRADE_RTP, then capped.
 * 1.00 matches $50→$100 = 50%, $100→$500 = 20%, $100→$1000 = 10%.
 */
export const UPGRADE_RTP = 1;

/** Playable floor (hail-mary). Formula is not raised to this; sub-1% rolls are rejected. */
export const UPGRADE_MIN_CHANCE = 1;
export const UPGRADE_MAX_CHANCE = 75;
export const UPGRADE_HIGH_VALUE = 100;
/** Input skins that can be staked in one upgrade. */
export const UPGRADE_MAX_ITEMS = 6;

/** Contract engine RTP 90–94% so EV sits slightly below input. */
export const CONTRACT_RTP = 0.92;

export const CONTRACT_MIN_ITEMS = 3;
export const CONTRACT_MAX_ITEMS = 10;

/** Reward pool band vs input market value. Includes outcomes below and above input. */
export const CONTRACT_POOL_LO = 0.24;
export const CONTRACT_POOL_HI = 3.6;

export const PRICE_CACHE_TTL_MS = 10 * 60 * 1000;
export const PRICE_SYNC_INTERVAL_MS = 10 * 60 * 1000;

/** Live feed TOP DROP if PriceProvider market >= this USD amount. */
export const TOP_DROP_THRESHOLD = 250;

/**
 * Case engine RTP / house edge (independent from upgrade / contracts).
 * Players can both lose (cheap blues) and profit (gold/red/knife) on a crate;
 * over many opens EV ≈ price × CASE_RTP, always under the ticket.
 * Per-case presets stay inside 92–94%. This number is NOT shown on case UI.
 */
export const CASE_RTP = 0.93;
export const CASE_HOUSE_EDGE = 0.07;

/**
 * Variance targets (probability mass). Majority still lose; break-even hits are common enough
 * that a short session can hit, jackpot stays rare.
 *   Lose  — payout < ticket (~65–72%)
 *   Win   — payout > ticket and < 4× (break-even band, ~25–30%)
 *   Jackpot — payout ≥ 4× (~2–3%)
 */
export const CASE_LOSE_MASS = 68;
export const CASE_WIN_MASS = 29.5;
export const CASE_JACKPOT_MASS = 2.5;

export const CASE_MIN_LOSE_MASS = 62;
export const CASE_MIN_WIN_MASS = 22;
export const CASE_MIN_JACKPOT_MASS = 1.85;
export const CASE_MAX_JACKPOT_MASS = 3.4;

/**
 * Published rarity-shaped prior (16 Aug): Common 60 / Uncommon 25 / Rare 10 /
 * Epic 4 / Legendary 0.9 / Mythic 0.1. Used to split the lose/win/jackpot
 * bands, then nudged to CASE_RTP.
 */
export const CASE_TIER_MASS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 0.9,
  mythic: 0.1,
} as const;

/** One filler cannot eat the reel. lockEvToTarget must honor this cap. */
export const CASE_MAX_SINGLE_CHANCE = 18;
