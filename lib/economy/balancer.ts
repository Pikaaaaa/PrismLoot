import type { CaseReward, Rarity } from "@/lib/types";
import { getSkinPrice } from "@/lib/services/prices/priceProvider";
import {
  CASE_JACKPOT_MASS,
  CASE_LOSE_MASS,
  CASE_MAX_JACKPOT_MASS,
  CASE_MAX_SINGLE_CHANCE,
  CASE_MIN_JACKPOT_MASS,
  CASE_MIN_LOSE_MASS,
  CASE_MIN_WIN_MASS,
  CASE_WIN_MASS,
} from "./config";

function sum(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0);
}

function evOf(pct: number[], values: number[]) {
  return pct.reduce((s, p, i) => s + (p / 100) * values[i], 0);
}

export type OddsTier = "low" | "medium" | "high" | "very-high" | "jackpot";

export function oddsTier(value: number, casePrice: number): OddsTier {
  const r = value / Math.max(casePrice, 0.01);
  if (r <= 1.15) return "low";
  if (r <= 2.8) return "medium";
  if (r <= 8) return "high";
  if (r <= 18) return "very-high";
  return "jackpot";
}

type Band = "lose" | "win" | "jack";

function typicalPayout(skinId: string, expected: number): number {
  for (const wear of ["ft", "mw"] as const) {
    const quote = getSkinPrice(skinId, wear);
    if (quote.available && quote.price && quote.price > 0) return quote.price;
  }
  return expected;
}

function bandOf(typical: number, casePrice: number, expected: number): Band {
  const jackMark = Math.max(typical, expected) / Math.max(casePrice, 0.01);
  if (jackMark >= 4) return "jack";
  // Band окуп by FT/MW (usual unbox wear), not EV — otherwise cheap skins wear-roll under the ticket.
  if (typical / Math.max(casePrice, 0.01) > 1) return "win";
  return "lose";
}

function shiftToward(pct: number[], from: number, to: number, values: number[], now: number, target: number, keep: number) {
  const d = values[from] - values[to];
  if (d <= 1e-9) return false;
  const move = Math.min(pct[from] - keep, ((now - target) / d) * 100);
  if (move <= 1e-8) return false;
  pct[from] -= move;
  pct[to] += move;
  return true;
}

/** Inverse-value deposit into `idxs`, never above `cap`. Returns amount actually placed. */
function depositCapped(
  pct: number[],
  idxs: number[],
  amount: number,
  values: number[],
  cap: number,
  exp = 0.7,
) {
  let left = amount;
  for (let step = 0; step < 24 && left > 1e-8; step++) {
    const room = idxs
      .map((i) => ({ i, room: cap - pct[i] }))
      .filter((row) => row.room > 0.01);
    if (!room.length) break;
    const weights = room.map((row) => 1 / Math.pow(Math.max(0.08, values[row.i]), exp));
    const wSum = sum(weights) || room.length;
    let placed = 0;
    room.forEach((row, k) => {
      const give = Math.min(row.room, left * (weights[k] / wSum));
      if (give <= 0) return;
      pct[row.i] += give;
      placed += give;
    });
    if (placed <= 1e-10) break;
    left -= placed;
  }
  return amount - left;
}

function shiftTowardCapped(
  pct: number[],
  from: number,
  dest: number[],
  values: number[],
  now: number,
  target: number,
  keep: number,
  cap: number,
) {
  const sinks = dest
    .filter((i) => i !== from && pct[i] < cap - 0.02)
    .sort((a, b) => values[a] - values[b]);
  const cheapSinks = sinks.slice(0, Math.max(3, Math.ceil(sinks.length * 0.55)));
  if (!cheapSinks.length) return false;
  const destValue = values[cheapSinks[0]];
  const d = values[from] - destValue;
  if (d <= 1e-9) return false;
  const move = Math.min(pct[from] - keep, ((now - target) / d) * 100);
  if (move <= 1e-8) return false;
  pct[from] -= move;
  const placed = depositCapped(pct, cheapSinks, move, values, cap);
  if (placed + 1e-8 < move) pct[from] += move - placed;
  return placed > 1e-8;
}

/**
 * Pull EV onto the RTP target without letting one filler eat the lose band.
 * Prefer reshuffling inside lose (cheaper skins get more, each capped).
 * Never throw — a miss must not take down the site.
 */
function lockEvToTarget(
  pct: number[],
  values: number[],
  casePrice: number,
  target: number,
  cheap: number,
  loseCap: number,
  winCap: number,
  loseIdx: number[],
  winIdx: number[],
  jackIdx: number[],
) {
  const sink = loseIdx.length
    ? loseIdx.slice().sort((a, b) => values[a] - values[b])[0]
    : cheap;
  const cheapWin = winIdx.slice().sort((a, b) => values[a] - values[b])[0];
  const loseMass = () => loseIdx.reduce((s, i) => s + pct[i], 0);
  const winMass = () => winIdx.reduce((s, i) => s + pct[i], 0);
  const jackMass = () => jackIdx.reduce((s, i) => s + pct[i], 0);
  const loseDest = () => loseIdx.filter((i) => pct[i] < loseCap - 0.02);

  for (let step = 0; step < 2500; step++) {
    const now = evOf(pct, values);
    if (now < casePrice && Math.abs(now - target) / target <= 0.012) return;
    if (now > target) {
      const fromLose = loseIdx
        .filter((i) => pct[i] > 0.8 && values[i] > values[sink] + 0.01)
        .sort((a, b) => values[b] * pct[b] - values[a] * pct[a])[0];
      if (fromLose != null && shiftTowardCapped(pct, fromLose, loseDest(), values, now, target, 0.6, loseCap)) {
        continue;
      }

      if (cheapWin != null) {
        const fromWin = winIdx
          .filter((i) => i !== cheapWin && pct[i] > 0.05 && values[i] > values[cheapWin] + 0.01)
          .sort((a, b) => values[b] - values[a])[0];
        if (fromWin != null && shiftToward(pct, fromWin, cheapWin, values, now, target, 0.05)) continue;
      }

      const dest = loseDest();
      const fromJack = jackIdx
        .filter((i) => pct[i] > 0.04)
        .sort((a, b) => values[b] - values[a])
        .find((i) => jackMass() - (pct[i] - 0.008) >= CASE_MIN_JACKPOT_MASS);
      if (fromJack != null && dest.length && shiftTowardCapped(pct, fromJack, dest, values, now, target, 0.04, loseCap)) {
        continue;
      }

      const fromWinToLose = winIdx
        .filter((i) => pct[i] > 0.05)
        .sort((a, b) => values[b] * pct[b] - values[a] * pct[a])
        .find((i) => winMass() - Math.min(pct[i] - 0.05, 0.4) >= 16);
      if (fromWinToLose != null && dest.length && shiftTowardCapped(pct, fromWinToLose, dest, values, now, target, 0.05, loseCap)) {
        continue;
      }
      return;
    }
    if (cheapWin == null || loseMass() <= CASE_MIN_LOSE_MASS + 0.05) return;
    const donor = loseIdx.filter((i) => pct[i] > 1.2).sort((a, b) => pct[b] - pct[a])[0];
    if (donor == null) return;
    const dest = winIdx.filter((i) => pct[i] < winCap - 0.05);
    if (!dest.length) return;
    const destValue = dest.reduce((s, i) => s + values[i], 0) / dest.length;
    const d = destValue - values[donor];
    if (d <= 1e-9) return;
    const move = Math.min(pct[donor] - 0.8, ((target - now) / d) * 100);
    if (move <= 1e-8) return;
    pct[donor] -= move;
    depositCapped(pct, dest, move, values, winCap);
  }
}

function splitBand(idxs: number[], mass: number, values: number[], cap: number, floor: number, exp = 0.7) {
  const pct = new Map<number, number>();
  if (!idxs.length || mass <= 0) return pct;
  const weights = idxs.map((i) => 1 / Math.pow(Math.max(0.08, values[i]), exp));
  const wSum = sum(weights) || idxs.length;
  const minEach = Math.min(floor, mass / (idxs.length * 1.8), cap);
  let rest = Math.max(0, mass - minEach * idxs.length);
  const raw = idxs.map((_, k) => minEach + rest * (weights[k] / wSum));
  idxs.forEach((i, k) => {
    pct.set(i, Math.min(cap, raw[k]));
  });
  let overflow = raw.reduce((s, p, k) => s + Math.max(0, p - (pct.get(idxs[k]) ?? 0)), 0);
  for (let step = 0; step < 16 && overflow > 1e-8; step++) {
    const room = idxs.filter((i) => (pct.get(i) ?? 0) < cap - 0.01);
    if (!room.length) break;
    const rw = room.map((i) => 1 / Math.pow(Math.max(0.08, values[i]), exp));
    const rSum = sum(rw) || room.length;
    let placed = 0;
    room.forEach((i, k) => {
      const cur = pct.get(i) ?? 0;
      const give = Math.min(cap - cur, overflow * (rw[k] / rSum));
      pct.set(i, cur + give);
      placed += give;
    });
    if (placed <= 1e-10) break;
    overflow -= placed;
  }
  return pct;
}

/** Push any item above `cap` into other same-band rows that still have room. */
function enforceSingleCap(pct: number[], idxs: number[], values: number[], cap: number) {
  for (let step = 0; step < 12; step++) {
    const fat = idxs.filter((i) => pct[i] > cap + 0.001);
    if (!fat.length) return;
    for (const i of fat) {
      const extra = pct[i] - cap;
      pct[i] = cap;
      depositCapped(pct, idxs.filter((j) => j !== i), extra, values, cap);
    }
  }
}

/**
 * Weighted loot: most opens lose, some окуп, rare jackpot.
 * EV locked to casePrice × RTP (house edge). Not 50/50. Not flat tiny-loss.
 */
export function generateCaseWeights(
  casePrice: number,
  rtp: number,
  items: Array<{ skinId: string; value: number; rarity: Rarity }>,
): CaseReward[] {
  if (items.length < 2) throw new Error("generateCaseWeights: need at least 2 rewards");
  const target = casePrice * rtp;
  if (!(target > 0)) throw new Error("generateCaseWeights: invalid target EV");

  const values = items.map((it) => it.value);
  const n = values.length;
  const cheap = values.reduce((b, _, i) => (values[i] < values[b] ? i : b), 0);
  const high = values.reduce((b, _, i) => (values[i] > values[b] ? i : b), 0);

  if (values[cheap] > target) {
    throw new Error(
      `generateCaseWeights: cheapest $${values[cheap].toFixed(2)} > target EV $${target.toFixed(2)} — raise case price or add cheaper same-weapon fillers`,
    );
  }

  const typical = items.map((it) => typicalPayout(it.skinId, it.value));
  const band: Band[] = values.map((_, i) => bandOf(typical[i] ?? values[i], casePrice, values[i]));
  const buckets: Record<Band, number[]> = { lose: [], win: [], jack: [] };
  for (let i = 0; i < n; i++) buckets[band[i]].push(i);

  if (!buckets.lose.length) {
    const byVal = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
    const take = Math.max(2, Math.ceil(n * 0.35));
    for (let k = 0; k < take; k++) {
      band[byVal[k]] = "lose";
    }
    buckets.lose = [];
    buckets.win = [];
    buckets.jack = [];
    for (let i = 0; i < n; i++) buckets[band[i]].push(i);
  }
  if (!buckets.win.length && !buckets.jack.length) {
    const byVal = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);
    const take = Math.max(2, Math.ceil(n * 0.22));
    for (let k = 0; k < take; k++) {
      if (band[byVal[k]] === "lose") band[byVal[k]] = k === 0 ? "jack" : "win";
    }
    buckets.lose = [];
    buckets.win = [];
    buckets.jack = [];
    for (let i = 0; i < n; i++) buckets[band[i]].push(i);
  }
  if (!buckets.jack.length && buckets.win.length) {
    const top = buckets.win.slice().sort((a, b) => values[b] - values[a])[0];
    band[top] = "jack";
    buckets.jack = [top];
    buckets.win = buckets.win.filter((i) => i !== top);
  }
  if (!buckets.jack.length) {
    band[high] = "jack";
    buckets.jack = [high];
    buckets.lose = buckets.lose.filter((i) => i !== high);
    buckets.win = buckets.win.filter((i) => i !== high);
  }

  let loseMass = buckets.lose.length ? CASE_LOSE_MASS : 0;
  let winMass = buckets.win.length ? CASE_WIN_MASS : 0;
  let jackMass = buckets.jack.length ? CASE_JACKPOT_MASS : 0;
  const live = (loseMass ? 1 : 0) + (winMass ? 1 : 0) + (jackMass ? 1 : 0);
  const assigned = loseMass + winMass + jackMass;
  if (assigned < 100 && live) {
    const extra = 100 - assigned;
    if (loseMass) loseMass += extra;
    else if (winMass) winMass += extra;
    else jackMass += extra;
  }

  const deep = buckets.lose.filter((i) => values[i] < casePrice * 0.55);
  const midLose = buckets.lose.filter((i) => values[i] >= casePrice * 0.55);
  const loseCap = CASE_MAX_SINGLE_CHANCE;
  const winCap = 10;
  const jackCap = Math.min(CASE_MAX_JACKPOT_MASS, Math.max(1.25, CASE_JACKPOT_MASS));
  const deepMass = Math.min(loseMass * 0.58, loseCap * Math.max(1, deep.length) * 0.85);

  const loseMap =
    deep.length && midLose.length
      ? new Map<number, number>([
          ...splitBand(deep, Math.min(deepMass, loseMass), values, loseCap, 0.15, 0.5),
          ...splitBand(midLose, Math.max(0, loseMass - deepMass), values, loseCap, 0.2, 0.5),
        ])
      : splitBand(buckets.lose, loseMass, values, loseCap, 0.15, 0.5);
  const winMap = splitBand(buckets.win, winMass, values, winCap, 0.12, 0.25);
  const jackMap = splitBand(buckets.jack, jackMass, values, jackCap, 0.04);

  const pct = new Array(n).fill(0);
  for (const [i, p] of loseMap) pct[i] = p;
  for (const [i, p] of winMap) pct[i] = p;
  for (const [i, p] of jackMap) pct[i] = p;

  const normalize = () => {
    const s = sum(pct);
    if (s <= 0) return;
    const k = 100 / s;
    for (let i = 0; i < n; i++) pct[i] *= k;
  };
  normalize();

  const massOf = (kind: Band) => buckets[kind].reduce((s, i) => s + pct[i], 0);

  const addTo = (idxs: number[], amount: number, cap: number) => {
    if (amount <= 0) return;
    const cheapBand = idxs.filter((i) => values[i] <= casePrice * 0.65);
    const pool = cheapBand.length ? cheapBand : idxs.length ? idxs : [cheap];
    const placed = depositCapped(pct, pool, amount, values, cap);
    if (placed + 1e-8 < amount) depositCapped(pct, idxs.length ? idxs : [cheap], amount - placed, values, cap);
  };

  const takeFrom = (idxs: number[], amount: number, minKeep: number) => {
    if (amount <= 0 || !idxs.length) return 0;
    const donors = idxs.filter((i) => pct[i] > minKeep + 0.01).sort((a, b) => values[b] - values[a]);
    if (!donors.length) return 0;
    let left = amount;
    for (const i of donors) {
      if (left <= 0) break;
      const give = Math.min(left, pct[i] - minKeep);
      pct[i] -= give;
      left -= give;
    }
    return amount - left;
  };

  for (let step = 0; step < 800; step++) {
    const now = evOf(pct, values);
    if (now < casePrice && Math.abs(now - target) / target <= 0.01) break;
    if (now > target) {
      const expensive = values
        .map((_, i) => i)
        .filter((i) => i !== cheap && pct[i] > 0.05 && values[i] > values[cheap] + 0.05)
        .filter((i) => {
          if (band[i] === "jack" && massOf("jack") <= CASE_MIN_JACKPOT_MASS + 0.05) return false;
          if (band[i] === "win" && massOf("win") <= CASE_MIN_WIN_MASS + 0.05) return false;
          return true;
        })
        .sort((a, b) => values[b] - values[a]);
      const from =
        expensive.find((i) => band[i] === "lose") ??
        expensive.find((i) => band[i] === "win") ??
        expensive[0];
      if (from == null) break;
      const d = values[from] - values[cheap];
      if (d <= 1e-9) break;
      const minKeep = band[from] === "jack" ? 0.04 : band[from] === "win" ? 0.1 : 0.12;
      const move = Math.min(pct[from] - minKeep, Math.max(0.0002, ((now - target) / d) * 100));
      if (move <= 0) break;
      pct[from] -= move;
      addTo(buckets.lose, move, loseCap);
    } else {
      if (massOf("lose") <= CASE_MIN_LOSE_MASS + 0.2) break;
      const to =
        buckets.win.filter((i) => pct[i] < winCap - 0.05).sort((a, b) => values[a] - values[b])[0] ??
        buckets.jack.filter((i) => pct[i] < jackCap - 0.02)[0];
      if (to == null) break;
      const from = buckets.lose.filter((i) => pct[i] > 0.4).sort((a, b) => values[a] - values[b])[0];
      if (from == null) break;
      const d = values[to] - values[from];
      if (d <= 1e-9) break;
      const cap = band[to] === "jack" ? jackCap : winCap;
      const move = Math.min(
        pct[from] - 0.15,
        cap - pct[to],
        Math.max(0.0002, ((target - now) / d) * 100),
      );
      if (move <= 0) break;
      pct[from] -= move;
      pct[to] += move;
    }
  }

  normalize();

  // Clamp whales on lose band.
  for (const i of buckets.lose) {
    if (pct[i] <= loseCap) continue;
    const extra = pct[i] - loseCap;
    pct[i] = loseCap;
    addTo(
      buckets.lose.filter((j) => j !== i),
      extra,
      loseCap,
    );
  }
  normalize();

  if (massOf("jack") > CASE_MAX_JACKPOT_MASS) {
    const extra = massOf("jack") - CASE_MAX_JACKPOT_MASS;
    takeFrom(buckets.jack, extra, 0.04);
    addTo(buckets.lose, extra, loseCap);
  }
  if (massOf("jack") < CASE_MIN_JACKPOT_MASS && buckets.jack.length) {
    const need = CASE_MIN_JACKPOT_MASS - massOf("jack");
    const room = Math.max(0, massOf("lose") - CASE_MIN_LOSE_MASS);
    const got = takeFrom(buckets.lose, Math.min(need, room), 0.2);
    addTo(buckets.jack, got, jackCap);
  }
  if (massOf("win") < CASE_MIN_WIN_MASS && buckets.win.length) {
    const need = CASE_MIN_WIN_MASS - massOf("win");
    const room = Math.max(0, massOf("lose") - CASE_MIN_LOSE_MASS);
    const got = takeFrom(buckets.lose, Math.min(need, room), 0.25);
    addTo(buckets.win, got, winCap);
  }

  normalize();

  for (let k = 0; k < 80; k++) {
    const now = evOf(pct, values);
    if (now < casePrice && Math.abs(now - target) / target <= 0.012) break;
    if (now > target) {
      const ranked = values
        .map((_, i) => i)
        .filter((i) => i !== cheap && pct[i] > 0.06 && values[i] > values[cheap] + 0.08)
        .sort((a, b) => values[b] - values[a]);
      const from =
        ranked.find((i) => band[i] === "lose") ??
        ranked.find((i) => band[i] === "win" && massOf("win") > CASE_MIN_WIN_MASS) ??
        ranked.find((i) => band[i] === "jack" && massOf("jack") > CASE_MIN_JACKPOT_MASS) ??
        ranked[0];
      if (from == null) break;
      if (band[from] === "jack" && massOf("jack") <= CASE_MIN_JACKPOT_MASS) {
        const alt = buckets.lose
          .filter((i) => i !== cheap && pct[i] > 0.2 && values[i] > values[cheap] + 0.08)
          .sort((a, b) => values[b] - values[a])[0];
        if (alt == null) break;
        const dAlt = values[alt] - values[cheap];
        const moveAlt = Math.min(pct[alt] - 0.12, Math.max(0, ((now - target) / dAlt) * 100));
        if (moveAlt <= 1e-6) break;
        pct[alt] -= moveAlt;
        addTo(
          buckets.lose.filter((i) => values[i] <= casePrice * 0.65),
          moveAlt,
          loseCap,
        );
        continue;
      }
      if (band[from] === "win" && massOf("win") <= CASE_MIN_WIN_MASS) {
        const alt = buckets.lose
          .filter((i) => i !== cheap && pct[i] > 0.2 && values[i] > values[cheap] + 0.08)
          .sort((a, b) => values[b] - values[a])[0];
        if (alt == null) break;
        const dAlt = values[alt] - values[cheap];
        const moveAlt = Math.min(pct[alt] - 0.12, Math.max(0, ((now - target) / dAlt) * 100));
        if (moveAlt <= 1e-6) break;
        pct[alt] -= moveAlt;
        addTo(
          buckets.lose.filter((i) => values[i] <= casePrice * 0.65),
          moveAlt,
          loseCap,
        );
        continue;
      }
      const d = values[from] - values[cheap];
      if (d <= 1e-9) break;
      const move = Math.min(pct[from] - 0.04, Math.max(0, ((now - target) / d) * 100));
      if (move <= 1e-6) break;
      pct[from] -= move;
      addTo(buckets.lose, move, loseCap);
    } else {
      if (massOf("lose") <= CASE_MIN_LOSE_MASS + 0.2) break;
      const to = buckets.win.filter((i) => pct[i] < winCap - 0.05).sort((a, b) => values[a] - values[b])[0] ?? buckets.jack[0];
      const from = buckets.lose.filter((i) => pct[i] > 2.5).sort((a, b) => pct[b] - pct[a])[0];
      if (to == null || from == null) break;
      const d = values[to] - values[from];
      if (d <= 1e-9) break;
      const move = Math.min(pct[from] - 0.8, Math.max(0, ((target - now) / d) * 100));
      if (move <= 1e-6) break;
      pct[from] -= move;
      pct[to] += move;
    }
  }

  normalize();

  lockEvToTarget(pct, values, casePrice, target, cheap, loseCap, winCap, buckets.lose, buckets.win, buckets.jack);
  enforceSingleCap(pct, buckets.lose, values, loseCap);

  for (let i = 0; i < n; i++) pct[i] = +Math.max(0.008, pct[i]).toFixed(4);
  let s = sum(pct);
  if (s > 100) {
    takeFrom(
      [...buckets.lose].sort((a, b) => values[a] - values[b]),
      s - 100,
      0.02,
    );
  } else if (s < 100) {
    depositCapped(pct, buckets.lose.length ? buckets.lose : [cheap], 100 - s, values, loseCap);
  }
  s = sum(pct);
  if (Math.abs(s - 100) > 0.00005) {
    const fixer = buckets.lose.find((i) => pct[i] + (100 - s) <= loseCap) ?? cheap;
    pct[fixer] = +(pct[fixer] + (100 - s)).toFixed(4);
  }

  lockEvToTarget(pct, values, casePrice, target, cheap, loseCap, winCap, buckets.lose, buckets.win, buckets.jack);
  enforceSingleCap(pct, buckets.lose, values, loseCap);
  enforceSingleCap(pct, buckets.win, values, winCap);
  enforceSingleCap(pct, buckets.jack, values, jackCap);

  // Last-resort: EV must stay under the ticket so the catalog can load.
  // Spread the sink across the lose band — never dump the remainder on one filler.
  if (evOf(pct, values) >= casePrice) {
    const overflow = evOf(pct, values) - casePrice * 0.995;
    const bandRank = (i: number) => {
      if (values[i] < casePrice) return 0;
      if (values[i] < casePrice * 4) return 1;
      return 2;
    };
    const donors = values
      .map((_, i) => i)
      .filter((i) => i !== cheap && pct[i] > 0.08)
      .sort((a, b) => {
        const br = bandRank(b) - bandRank(a);
        if (br !== 0) return br;
        return values[b] - values[a];
      });
    for (const from of donors) {
      if (evOf(pct, values) < casePrice) break;
      const dest = buckets.lose.filter((i) => i !== from && pct[i] < loseCap - 0.02);
      if (!dest.length) continue;
      const destValue = dest.reduce((acc, i) => acc + values[i], 0) / dest.length;
      const d = values[from] - destValue;
      if (d <= 1e-9) continue;
      const move = Math.min(pct[from] - 0.04, Math.max(0, (overflow / d) * 100));
      if (move <= 1e-8) continue;
      pct[from] -= move;
      depositCapped(pct, dest, move, values, loseCap);
    }
  }

  enforceSingleCap(pct, buckets.lose, values, loseCap);
  s = sum(pct);
  if (Math.abs(s - 100) > 0.00005) {
    const fixer = buckets.lose.find((i) => pct[i] + (100 - s) <= loseCap && pct[i] + (100 - s) >= 0.008) ?? cheap;
    pct[fixer] = +(Math.min(loseCap, Math.max(0.008, pct[fixer] + (100 - s)))).toFixed(4);
  }

  if (massOf("win") < CASE_MIN_WIN_MASS && buckets.win.length) {
    const need = CASE_MIN_WIN_MASS - massOf("win");
    const room = Math.max(0, massOf("lose") - CASE_MIN_LOSE_MASS);
    const got = takeFrom(buckets.lose, Math.min(need, room), 0.8);
    addTo(buckets.win, got, winCap);
  }
  if (massOf("jack") < CASE_MIN_JACKPOT_MASS && buckets.jack.length) {
    const need = CASE_MIN_JACKPOT_MASS - massOf("jack");
    const room = Math.max(0, massOf("lose") - CASE_MIN_LOSE_MASS);
    const got = takeFrom(buckets.lose, Math.min(need, room), 0.8);
    addTo(buckets.jack, got, jackCap);
  }
  lockEvToTarget(pct, values, casePrice, target, cheap, loseCap, winCap, buckets.lose, buckets.win, buckets.jack);
  enforceSingleCap(pct, buckets.lose, values, loseCap);
  enforceSingleCap(pct, buckets.win, values, winCap);
  enforceSingleCap(pct, buckets.jack, values, jackCap);

  // Anti-minus last: EV must stay under the ticket. Spread into cheapest lose rows still under cap.
  for (let step = 0; step < 400 && evOf(pct, values) >= casePrice * 0.997; step++) {
    const dest = buckets.lose.filter((i) => pct[i] < loseCap - 0.02).sort((a, b) => values[a] - values[b]);
    const sinks = dest.slice(0, Math.max(1, Math.ceil(dest.length * 0.5)));
    if (!sinks.length) break;
    const destValue = values[sinks[0]];
    const from = values
      .map((_, i) => i)
      .filter((i) => !sinks.includes(i) && pct[i] > 0.06 && values[i] > destValue + 0.02)
      .sort((a, b) => values[b] - values[a])[0];
    if (from == null) break;
    const d = values[from] - destValue;
    const overflow = evOf(pct, values) - casePrice * 0.993;
    const move = Math.min(pct[from] - 0.05, Math.max(0.002, (overflow / d) * 100));
    if (move <= 1e-8) break;
    pct[from] -= move;
    const placed = depositCapped(pct, sinks, move, values, loseCap);
    if (placed + 1e-8 < move) pct[from] += move - placed;
  }
  enforceSingleCap(pct, buckets.lose, values, loseCap);
  normalize();
  enforceSingleCap(pct, buckets.lose, values, loseCap);
  enforceSingleCap(pct, buckets.win, values, winCap);
  enforceSingleCap(pct, buckets.jack, values, jackCap);
  s = sum(pct);
  if (s > 100.0001) takeFrom(buckets.lose, s - 100, 0.5);
  else if (s < 99.9999) depositCapped(pct, buckets.lose.length ? buckets.lose : [cheap], 100 - s, values, loseCap);
  s = sum(pct);
  if (Math.abs(s - 100) > 0.00005) {
    const fixer = buckets.lose.find((i) => {
      const next = pct[i] + (100 - s);
      return next <= loseCap && next >= 0.008;
    }) ?? cheap;
    pct[fixer] = +(Math.min(loseCap, Math.max(0.008, pct[fixer] + (100 - s)))).toFixed(4);
  }

  for (let step = 0; step < 2000; step++) {
    const now = evOf(pct, values);
    if (now < casePrice && Math.abs(now - target) / target <= 0.012) break;
    if (now > target) {
      const sinks = buckets.lose.filter((i) => pct[i] < loseCap - 0.02).sort((a, b) => values[a] - values[b]);
      const cheapSinks = sinks.slice(0, Math.max(3, Math.ceil(sinks.length * 0.55)));
      if (!cheapSinks.length) break;
      const destV = values[cheapSinks[0]];
      const from =
        buckets.jack
          .filter((i) => pct[i] > 0.05 && massOf("jack") > CASE_MIN_JACKPOT_MASS + 0.08)
          .sort((a, b) => values[b] - values[a])[0] ??
        buckets.win
          .filter((i) => pct[i] > 0.08 && massOf("win") > Math.min(CASE_MIN_WIN_MASS, 16) + 0.08)
          .sort((a, b) => values[b] - values[a])[0] ??
        buckets.lose
          .filter((i) => !cheapSinks.includes(i) && pct[i] > 0.8 && values[i] > destV + 0.05)
          .sort((a, b) => values[b] - values[a])[0];
      if (from == null) break;
      const d = values[from] - destV;
      if (d <= 1e-9) break;
      const keep = band[from] === "jack" ? 0.04 : 0.08;
      const move = Math.min(pct[from] - keep, Math.max(0.002, ((now - target) / d) * 100));
      if (move <= 1e-8) break;
      pct[from] -= move;
      const placed = depositCapped(pct, cheapSinks, move, values, loseCap);
      if (placed + 1e-8 < move) pct[from] += move - placed;
      if (placed <= 1e-8) break;
    } else {
      if (massOf("lose") <= CASE_MIN_LOSE_MASS + 0.1) break;
      const dest = buckets.win.filter((i) => pct[i] < winCap - 0.05);
      const jackDest = buckets.jack.filter((i) => pct[i] < jackCap - 0.02);
      const sinkBand = dest.length ? dest : jackDest;
      const sinkCap = dest.length ? winCap : jackCap;
      if (!sinkBand.length) break;
      const donor = buckets.lose.filter((i) => pct[i] > 1.5).sort((a, b) => pct[b] - pct[a])[0];
      if (donor == null) break;
      const destV = sinkBand.reduce((acc, i) => acc + values[i], 0) / sinkBand.length;
      const d = destV - values[donor];
      if (d <= 1e-9) break;
      const move = Math.min(pct[donor] - 0.8, Math.max(0.002, ((target - now) / d) * 100));
      if (move <= 1e-8) break;
      pct[donor] -= move;
      const placed = depositCapped(pct, sinkBand, move, values, sinkCap);
      if (placed + 1e-8 < move) pct[donor] += move - placed;
      if (placed <= 1e-8) break;
    }
  }
  enforceSingleCap(pct, buckets.lose, values, loseCap);
  enforceSingleCap(pct, buckets.win, values, winCap);
  s = sum(pct);
  if (Math.abs(s - 100) > 0.00005) {
    const fixer = buckets.lose.find((i) => {
      const next = pct[i] + (100 - s);
      return next <= loseCap && next >= 0.008;
    }) ?? cheap;
    pct[fixer] = +(Math.min(loseCap, Math.max(0.008, pct[fixer] + (100 - s)))).toFixed(4);
  }

  return items.map((it, i) => ({
    skinId: it.skinId,
    value: it.value,
    rarity: it.rarity,
    chance: pct[i],
    weight: Math.max(1, Math.round(pct[i] * 10000)),
  }));
}
