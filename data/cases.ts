import { SKINS, SKIN_MAP } from "@/data/skins";
import { caseArtPaths } from "@/lib/case-art";
import { generateCaseWeights, validateCase } from "@/lib/economy";
import { requireMarketPrice } from "@/lib/services/prices/priceProvider";
import { houseEdgeFromRtp, RTP_PRESETS } from "@/lib/economy/rtp";
import { expectedUnboxPrice } from "@/lib/wear";
import type {
  CaseAnimation,
  CaseSection,
  CaseTag,
  Crate,
  Rarity,
  RtpPreset,
  Weapon,
} from "@/lib/types";

function skin(id: string) {
  const row = SKIN_MAP[id];
  if (!row) throw new Error(`Missing catalog skin ${id}`);
  return row;
}

/** Listing quote for pool windows (which skins can appear). */
function listing(id: string) {
  return requireMarketPrice(id);
}

/** Case engine value = expected unbox payout (wear mix), not listing FT or FN max. */
function market(id: string) {
  return expectedUnboxPrice(id);
}

export const KNIFE_WEAPONS: Weapon[] = [
  "Karambit",
  "Butterfly Knife",
  "M9 Bayonet",
  "Bayonet",
  "Flip Knife",
  "Gut Knife",
  "Falchion Knife",
  "Bowie Knife",
  "Huntsman Knife",
  "Shadow Daggers",
  "Navaja Knife",
  "Stiletto Knife",
  "Talon Knife",
  "Ursus Knife",
  "Classic Knife",
  "Paracord Knife",
  "Survival Knife",
  "Nomad Knife",
  "Skeleton Knife",
  "Kukri Knife",
];

export const GLOVE_WEAPONS: Weapon[] = ["Gloves"];

const LUXURY_ONLY = new Set([
  "awp-lore",
  "awp-gungnir",
  "m4-howl",
  "ak-gold-arabesque",
  "m4-knight",
  "glock-fade",
]);

/** Listing floor for pool windows — scales with ticket so expensive crates aren't 80% trash. */
function poolFloor(price: number) {
  if (price <= 8) return 0.05;
  if (price <= 15) return Math.max(0.12, price * 0.08);
  if (price <= 40) return price * 0.16;
  if (price <= 100) return price * 0.22;
  if (price <= 300) return price * 0.26;
  if (price <= 700) return price * 0.3;
  return price * 0.32;
}

/** Max share of pool allowed below ticket. Leave room for cheap lose fillers. */
function maxBelowTicketShare(price: number) {
  if (price <= 15) return 0.58;
  if (price <= 50) return 0.48;
  return 0.44;
}

/** Max share of pool allowed below 75% of ticket (RTP lose anchors). */
function maxBelowShare(price: number) {
  if (price <= 15) return 0.56;
  if (price <= 50) return 0.5;
  if (price <= 150) return 0.46;
  return 0.42;
}

function poolWindow(section: CaseSection, price: number) {
  const floor = poolFloor(price);
  switch (section) {
    case "starter":
      return { minV: floor, maxV: Math.min(price * 14, 48), size: 36 };
    case "budget":
      return { minV: floor, maxV: Math.min(price * 12, 165), size: 38 };
    case "standard":
      return { minV: Math.max(floor, price * 0.1), maxV: Math.min(price * 14, 900), size: 40 };
    case "premium":
      return { minV: Math.max(floor, price * 0.14), maxV: Math.min(Math.max(price * 14, 420), 4500), size: 42 };
    case "high-tier":
      return { minV: Math.max(floor, price * 0.14), maxV: Math.min(price * 12, 12_000), size: 44 };
    case "luxury":
      return { minV: Math.max(floor, price * 0.14), maxV: Math.min(price * 10, 20_000), size: 46 };
    case "pistols":
    case "rifles":
    case "awp":
    case "collections":
      return { minV: floor, maxV: Math.min(Math.max(price * 10, 90), 2500), size: 40 };
    case "knives":
      return { minV: Math.max(floor, price * 0.14), maxV: Math.min(price * 9, 18_000), size: 50 };
    case "gloves":
      return { minV: Math.max(floor, price * 0.16), maxV: Math.min(price * 9, 8000), size: 50 };
    default:
      return { minV: floor, maxV: Math.min(price * 14, 400), size: 36 };
  }
}

function catalogForWeapons(weapons: Weapon[]) {
  const allow = new Set(weapons);
  return SKINS.filter((row) => allow.has(row.weapon)).map((row) => row.id);
}

function mixHash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mixFromCatalog(
  key: string,
  featured: string,
  opts: {
    min: number;
    max: number;
    size: number;
    knives?: boolean;
    gloves?: boolean;
    weapons?: Weapon[];
    extras?: string[];
  },
): string[] {
  const allowW = opts.weapons ? new Set(opts.weapons) : null;
  const rows = SKINS.filter((s) => {
    if (s.id === featured) return false;
    if (allowW && !allowW.has(s.weapon)) return false;
    if (!opts.knives && KNIFE_WEAPONS.includes(s.weapon)) return false;
    if (!opts.gloves && s.weapon === "Gloves") return false;
    try {
      const p = listing(s.id);
      return p >= opts.min && p <= opts.max;
    } catch {
      return false;
    }
  });
  rows.sort((a, b) => mixHash(`${key}:${a.id}`) - mixHash(`${key}:${b.id}`) || a.id.localeCompare(b.id));
  const out: string[] = [];
  const seen = new Set<string>();
  const take = (id: string) => {
    if (!id || seen.has(id) || !SKIN_MAP[id]) return;
    seen.add(id);
    out.push(id);
  };
  take(featured);
  for (const id of opts.extras ?? []) take(id);
  for (const row of rows) {
    if (out.length >= opts.size) break;
    take(row.id);
  }
  return out;
}

function mixCase(id: string, featured: string, price: number, section: CaseSection, extra?: Omit<Parameters<typeof mixFromCatalog>[2], "min" | "max" | "size"> & { size?: number }) {
  const win = poolWindow(section, price);
  return mixFromCatalog(id, featured, {
    min: win.minV,
    max: win.maxV,
    size: extra?.size ?? Math.max(win.size + 10, 46),
    knives: extra?.knives,
    gloves: extra?.gloves,
    weapons: extra?.weapons,
    extras: extra?.extras,
  });
}

function fillPool(
  seed: string[],
  minV: number,
  maxV: number,
  size: number,
  featured: string,
  caseId: string,
  casePrice: number,
  weapons?: Weapon[],
) {
  const cheapCase = casePrice <= 15;
  const allowJackpot = casePrice >= 399;
  const weaponSet = weapons?.length ? new Set(weapons) : null;

  const weaponOk = (id: string) => {
    if (!weaponSet) return true;
    const row = SKIN_MAP[id];
    return !!row && weaponSet.has(row.weapon);
  };

  const allowed = (id: string, asFeatured = false, asFiller = false) => {
    if (!SKIN_MAP[id] || !weaponOk(id)) return false;
    try {
      const p = listing(id);
      if (cheapCase && LUXURY_ONLY.has(id)) return false;
      if (asFeatured) {
        if (cheapCase && p > Math.max(maxV, casePrice * 22)) return false;
        return true;
      }
      if (asFiller) {
        if (weaponSet) {
          if (cheapCase && LUXURY_ONLY.has(id)) return false;
          const fillerMin = cheapCase
            ? minV
            : Math.max(minV, casePrice * (casePrice >= 100 ? 0.48 : casePrice >= 40 ? 0.28 : 0.14));
          if (p < fillerMin && id !== featured) return false;
          const bulkMax = Math.max(casePrice * 3.8, minV * 6);
          if (p > bulkMax) return id === featured;
          return true;
        }
        if (p > maxV) return false;
        if (!allowJackpot && p > casePrice * 18) return false;
        return true;
      }
      if (p < minV || p > maxV) return false;
      if (cheapCase && p > Math.min(maxV, casePrice * 12)) return false;
      if (!allowJackpot && p > casePrice * 18) return false;
      return true;
    } catch {
      return false;
    }
  };

  let featuredId = featured;
  if (!allowed(featuredId, true)) {
    const fromSeed = seed.filter((id) => allowed(id));
    if (!fromSeed.length) throw new Error(`${caseId}: no skins in $${minV}–$${maxV}`);
    const target = Math.min(maxV * 0.85, Math.max(minV * 3, casePrice * 2.4));
    featuredId = fromSeed.slice().sort((a, b) => Math.abs(listing(a) - target) - Math.abs(listing(b) - target))[0];
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const take = (id: string, asFiller = false) => {
    if (seen.has(id) || !SKIN_MAP[id]) return false;
    const keep = id === featuredId ? allowed(id, true) : allowed(id, false, asFiller);
    if (!keep) return false;
    seen.add(id);
    ids.push(id);
    return true;
  };

  take(featuredId);
  for (const id of seed) {
    if (ids.length >= size) break;
    take(id);
  }

  // Seed-only rescue: remaining configured ids, slightly looser cap, still never global SKINS.
  if (ids.length < 25) {
    for (const id of seed) {
      if (ids.length >= 25) break;
      if (seen.has(id) || !SKIN_MAP[id] || !weaponOk(id)) continue;
      if (cheapCase && LUXURY_ONLY.has(id)) continue;
      try {
        const p = listing(id);
        const rescueCap = weaponSet ? Math.max(maxV, casePrice * 8) : casePrice * 24;
        if (!allowJackpot && p > rescueCap) continue;
        seen.add(id);
        ids.push(id);
      } catch {
        continue;
      }
    }
  }

  // Specialist crates: same-weapon mid-tier fillers — never global mixed SKINS.
  if (weapons?.length) {
    const fillerMin = cheapCase
      ? minV
      : Math.max(minV, casePrice * (casePrice >= 100 ? 0.48 : casePrice >= 40 ? 0.28 : 0.14));
    const same = catalogForWeapons(weapons)
      .filter((id) => {
        if (id === featuredId) return true;
        try {
          return listing(id) >= fillerMin;
        } catch {
          return false;
        }
      })
      .slice()
      .sort((a, b) => {
        try {
          const da = Math.abs(listing(a) - casePrice * 1.05);
          const db = Math.abs(listing(b) - casePrice * 1.05);
          return da - db || listing(a) - listing(b);
        } catch {
          return 0;
        }
      });
    for (const id of same) {
      if (ids.length >= 50) break;
      take(id, true);
    }
  }

  if (ids.length < 25) {
    const catalogN = weapons?.length ? catalogForWeapons(weapons).length : 0;
    const fullWeaponBook = weapons?.length === 1 && ids.length >= 22 && ids.length >= Math.min(25, catalogN);
    if (!fullWeaponBook) {
      throw new Error(`${caseId}: pool only ${ids.length} from seed (need 25, never global SKINS)`);
    }
  }
  if (weapons?.length && !ids.every(weaponOk)) {
    throw new Error(`${caseId}: fillPool leaked a non-seed weapon`);
  }

  const quote = (id: string) => {
    try {
      return listing(id);
    } catch {
      return 0;
    }
  };
  const featuredRatio = quote(featuredId) / Math.max(casePrice, 0.01);
  // Only replace a too-cheap showcase. Starter crates can advertise 12–20× chase items.
  const keepFeatured = LUXURY_ONLY.has(featuredId) || featuredRatio >= 3.2;
  if (!keepFeatured && ids.length) {
    const target = casePrice * (casePrice >= 400 ? 6 : casePrice >= 40 ? 7.5 : 8.5);
    const cap = cheapCase ? Math.max(maxV, casePrice * 22) : casePrice * 22;
    let best = featuredId;
    let bestD = Infinity;
    for (const id of ids) {
      if (cheapCase && LUXURY_ONLY.has(id)) continue;
      const p = quote(id);
      if (!(p > 0) || p > cap) continue;
      const d = Math.abs(p - target);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    featuredId = best;
  }

  if (weaponSet) {
    const feat = featuredId;
    const rest = ids.filter((id) => id !== feat);
    rest.sort((a, b) => quote(a) - quote(b));
    ids.length = 0;
    ids.push(feat, ...rest);
  }

  // Trim trash flood; pad playable band so the reel isn't 80% sub-ticket skins.
  const minPool = weapons?.length === 1 ? 22 : 25;
  const belowCut = casePrice * 0.75;
  const playableMin = casePrice <= 15 ? casePrice * 0.12 : casePrice * 0.55;
  const anchorCap = casePrice * (casePrice <= 15 ? 0.62 : 0.46);
  const maxBelow = Math.max(2, Math.floor(ids.length * maxBelowShare(casePrice)));

  const unbox = (id: string) => {
    try {
      return market(id);
    } catch {
      return Infinity;
    }
  };

  let below = ids.filter((id) => unbox(id) < belowCut);
  if (below.length > maxBelow) {
    const featBelow = unbox(featuredId) < belowCut;
    const others = below.filter((id) => id !== featuredId).sort((a, b) => unbox(a) - unbox(b));
    const keep = new Set(others.slice(0, Math.max(1, maxBelow - (featBelow ? 1 : 0))));
    if (featBelow) keep.add(featuredId);
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i];
      if (unbox(id) < belowCut && !keep.has(id)) {
        if (ids.length <= minPool) break;
        ids.splice(i, 1);
      }
    }
  }

  const playableTarget = Math.ceil(Math.min(size, 50) * 0.42);
  const extras = new Set<string>(seed);
  if (weapons?.length) {
    for (const id of catalogForWeapons(weapons)) extras.add(id);
  }
  const candidates = [...extras]
    .filter((id) => !ids.includes(id) && SKIN_MAP[id] && weaponOk(id))
    .filter((id) => {
      try {
        const p = listing(id);
        return p >= playableMin && p <= Math.max(maxV, casePrice * 3.2);
      } catch {
        return false;
      }
    })
    .sort((a, b) => Math.abs(listing(a) - casePrice * 1.15) - Math.abs(listing(b) - casePrice * 1.15));

  for (const id of candidates) {
    if (ids.filter((row) => unbox(row) >= playableMin).length >= playableTarget) break;
    if (ids.length >= Math.min(50, size + 8)) break;
    ids.push(id);
  }

  if (!ids.some((id) => unbox(id) <= anchorCap)) {
    const anchor = [...extras]
      .filter((id) => SKIN_MAP[id] && weaponOk(id))
      .filter((id) => {
        try {
          return unbox(id) <= anchorCap;
        } catch {
          return false;
        }
      })
      .sort((a, b) => unbox(a) - unbox(b))[0];
    if (anchor && !ids.includes(anchor)) ids.push(anchor);
  }

  const belowTicketCut = casePrice;
  let maxBelowTicket = Math.max(2, Math.floor(ids.length * maxBelowTicketShare(casePrice)));
  const aboveInCatalog = [...extras].filter((id) => {
    try {
      return listing(id) >= casePrice * 0.9;
    } catch {
      return false;
    }
  });
  const aboveInPool = ids.filter((id) => unbox(id) >= belowTicketCut);
  if (aboveInCatalog.length >= 14 && aboveInPool.length >= 8 && ids.length > minPool + 4) {
    maxBelowTicket = Math.min(maxBelowTicket, casePrice >= 100 ? 10 : 8);
  }
  let belowTicket = ids.filter((id) => unbox(id) < belowTicketCut);
  if (belowTicket.length > maxBelowTicket) {
    const featBelowTicket = unbox(featuredId) < belowTicketCut;
    const minRatio = casePrice <= 15 ? 0.35 : 0.68;
    const others = belowTicket
      .filter((id) => id !== featuredId)
      .sort((a, b) => {
        const ra = unbox(a) / casePrice;
        const rb = unbox(b) / casePrice;
        const score = (r: number) => {
          if (r < 0.5) return Math.abs(r - 0.32);
          if (r < minRatio) return 0.35 + Math.abs(r - 0.6);
          return 0.9 + Math.abs(r - 0.82);
        };
        return score(ra) - score(rb) || unbox(a) - unbox(b);
      });
    const keep = new Set(others.slice(0, Math.max(1, maxBelowTicket - (featBelowTicket ? 1 : 0))));
    if (featBelowTicket) keep.add(featuredId);
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i];
      if (unbox(id) < belowTicketCut && !keep.has(id)) {
        if (ids.length <= minPool) break;
        ids.splice(i, 1);
      }
    }
  }

  const belowTicketTarget = casePrice <= 15 ? 6 : casePrice <= 100 ? 8 : 8;
  const belowBandMin = casePrice * (casePrice <= 15 ? 0.2 : 0.28);
  const belowBandMax = casePrice * 0.98;
  const belowPad = [...extras]
    .filter((id) => !ids.includes(id) && SKIN_MAP[id] && weaponOk(id))
    .filter((id) => {
      try {
        const p = listing(id);
        return p >= belowBandMin && p < belowTicketCut;
      } catch {
        return false;
      }
    })
    .sort((a, b) => Math.abs(listing(a) - casePrice * 0.86) - Math.abs(listing(b) - casePrice * 0.86));
  for (const id of belowPad) {
    const haveBelow = ids.filter((row) => unbox(row) < belowTicketCut).length;
    if (haveBelow >= belowTicketTarget) break;
    if (ids.length >= Math.min(50, size + 4)) break;
    ids.push(id);
  }

  if (ids.length < minPool) {
    const rescue = [...seed, ...extras]
      .filter((id) => !ids.includes(id) && SKIN_MAP[id] && weaponOk(id))
      .sort((a, b) => {
        try {
          return Math.abs(listing(a) - casePrice) - Math.abs(listing(b) - casePrice);
        } catch {
          return 0;
        }
      });
    for (const id of rescue) {
      if (ids.length >= minPool) break;
      ids.push(id);
    }
  }
  if (ids.length < minPool) {
    throw new Error(`${caseId}: pool only ${ids.length} after trim (need ${minPool})`);
  }

  const anchorNeed = casePrice <= 15 ? 2 : casePrice <= 100 ? 3 : 4;
  let anchors = ids.filter((id) => unbox(id) <= anchorCap).length;
  if (anchors < anchorNeed) {
    const anchorCandidates = [...extras]
      .filter((id) => !ids.includes(id) && SKIN_MAP[id] && weaponOk(id))
      .filter((id) => {
        try {
          return unbox(id) <= anchorCap;
        } catch {
          return false;
        }
      })
      .sort((a, b) => unbox(a) - unbox(b));
    for (const id of anchorCandidates) {
      if (anchors >= anchorNeed) break;
      if (ids.length >= 50) break;
      ids.push(id);
      anchors += 1;
    }
  }

  const nearTicketMin = casePrice * 0.82;
  const nearTicketMax = casePrice * 1.38;
  const nearTarget = Math.max(4, Math.ceil(Math.min(size, 50) * 0.22));
  const nearCandidates = [...extras]
    .filter((id) => !ids.includes(id) && SKIN_MAP[id] && weaponOk(id))
    .filter((id) => {
      try {
        const p = listing(id);
        return p >= nearTicketMin && p <= Math.min(nearTicketMax, maxV * 1.05);
      } catch {
        return false;
      }
    })
    .sort((a, b) => Math.abs(listing(a) - casePrice) - Math.abs(listing(b) - casePrice));
  for (const id of nearCandidates) {
    const haveNear = ids.filter((row) => {
      const v = unbox(row);
      return v >= nearTicketMin && v <= nearTicketMax;
    }).length;
    if (haveNear >= nearTarget) break;
    if (ids.length >= Math.min(50, size + 6)) break;
    ids.push(id);
  }

  const midLoseNeed = casePrice <= 15 ? 5 : 6;
  const midLosePad = [...extras]
    .filter((id) => !ids.includes(id) && SKIN_MAP[id] && weaponOk(id))
    .filter((id) => {
      try {
        const v = unbox(id);
        return v >= casePrice * 0.5 && v < casePrice * 0.95;
      } catch {
        return false;
      }
    })
    .sort((a, b) => Math.abs(unbox(a) - casePrice * 0.72) - Math.abs(unbox(b) - casePrice * 0.72));
  for (const id of midLosePad) {
    const have = ids.filter((row) => {
      const v = unbox(row);
      return v >= casePrice * 0.5 && v < casePrice;
    }).length;
    if (have >= midLoseNeed) break;
    if (ids.length >= Math.min(50, size + 6)) break;
    ids.push(id);
  }

  const winNeed = 4;
  const jackNeed = 2;
  const winPad = [...extras]
    .filter((id) => !ids.includes(id) && SKIN_MAP[id] && weaponOk(id))
    .filter((id) => {
      try {
        return unbox(id) > casePrice * 1.2 && unbox(id) <= Math.max(maxV, casePrice * 12);
      } catch {
        return false;
      }
    })
    .sort((a, b) => unbox(a) - unbox(b));
  for (const id of winPad) {
    const haveWin = ids.filter((row) => unbox(row) > casePrice * 1.15).length;
    const haveJack = ids.filter((row) => unbox(row) >= casePrice * 4).length;
    if (haveWin >= winNeed && haveJack >= jackNeed) break;
    if (ids.length >= 50) break;
    const v = unbox(id);
    if (v >= casePrice * 4 && haveJack >= jackNeed) continue;
    if (v < casePrice * 4 && haveWin - haveJack >= winNeed) continue;
    ids.push(id);
  }

  const want = weapons?.length ? Math.min(50, Math.max(38, size)) : Math.min(50, Math.max(25, size));

  // Listing quotes can be FN-high while unbox EV is a $60 dagger — drop those
  // from expensive tapes so Common 60% is not 0.14× trash.
    if (casePrice >= 80) {
    const unboxFloor = casePrice <= 300 ? casePrice * 0.22 : casePrice * 0.28;
    if (unbox(featuredId) < unboxFloor) {
      const better = ids
        .filter((id) => unbox(id) >= unboxFloor)
        .sort((a, b) => Math.abs(unbox(a) - casePrice * 6) - Math.abs(unbox(b) - casePrice * 6))[0];
      if (better) featuredId = better;
    }
    const kept = ids.filter((id) => unbox(id) >= unboxFloor || id === featuredId);
    if (kept.length >= minPool) {
      ids.length = 0;
      ids.push(...kept);
    } else {
      const below = ids
        .filter((id) => !kept.includes(id))
        .sort((a, b) => unbox(b) - unbox(a));
      ids.length = 0;
      ids.push(...kept);
      for (const id of below) {
        if (ids.length >= minPool) break;
        ids.push(id);
      }
    }
    if (!ids.includes(featuredId)) ids.unshift(featuredId);
  }

  return { ids: ids.slice(0, Math.min(ids.length, want)), featuredId };
}

function makeCase(config: {
  id: string;
  name: string;
  price: number;
  preset: RtpPreset;
  tags: CaseTag[];
  section: CaseSection;
  accent: string;
  accent2: string;
  blurb: string;
  featuredReward: string;
  skinIds: string[];
  animationType: CaseAnimation;
  popularity?: number;
  createdAt?: number;
  weapons?: Weapon[];
}): Crate {
  const { rtp } = RTP_PRESETS[config.preset];
  if (!(rtp < 1)) throw new Error(`${config.id}: RTP preset must be below 100%`);
  const win = poolWindow(config.section, config.price);
  const { ids: unique, featuredId } = fillPool(
    config.skinIds,
    win.minV,
    win.maxV,
    win.size,
    config.featuredReward,
    config.id,
    config.price,
    config.weapons,
  );
  const items = unique.map((id) => {
    const s = skin(id);
    return { skinId: id, value: market(id), rarity: s.rarity as Rarity };
  });
  const rewards = generateCaseWeights(config.price, rtp, items);
  const art = caseArtPaths(config.id);
  const rarityDistribution = rewards.reduce<Partial<Record<Rarity, number>>>((acc, row) => {
    acc[row.rarity] = +((acc[row.rarity] ?? 0) + row.chance).toFixed(4);
    return acc;
  }, {});
  const crate: Crate = {
    id: config.id,
    name: config.name,
    description: config.blurb,
    price: config.price,
    tags: config.tags,
    section: config.section,
    accent: config.accent,
    accent2: config.accent2,
    blurb: config.blurb,
    image: art.image,
    thumbnail: art.thumbnail,
    background: art.background,
    theme: art.theme ?? config.section,
    glow: config.accent,
    animationType: config.animationType,
    rarityDistribution,
    popularity: config.popularity ?? (config.tags.includes("popular") ? 90 : 40),
    createdAt: config.createdAt ?? Date.UTC(2026, 6, 10),
    rtp,
    houseEdge: houseEdgeFromRtp(rtp),
    rtpPreset: config.preset,
    rewards,
    featuredReward: featuredId,
    loot: rewards.map((r) => ({ skinId: r.skinId, chance: r.chance })),
  };
  validateCase(crate);
  return crate;
}

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export const CASES: Crate[] = uniqueById([
  makeCase({
    id: "genesis-case",
    name: "Genesis",
    price: 1.99,
    preset: "low-risk",
    tags: ["cheap", "new", "popular"],
    section: "starter",
    accent: "#67e8f9",
    accent2: "#34d399",
    blurb: "Where operators start. Mixed budget rifles, SMGs and sidearms — no knives.",
    animationType: "roulette",
    popularity: 99,
    featuredReward: "glock-water",
    skinIds: mixCase("genesis-case", "glock-water", 1.99, "starter"),
  }),
  makeCase({
    id: "street-economy",
    name: "Street Economy",
    price: 1.49,
    preset: "standard",
    tags: ["cheap"],
    section: "starter",
    accent: "#94a3b8",
    accent2: "#64748b",
    blurb: "Pavement pool. Grind inventory without burning the stack.",
    animationType: "vertical",
    featuredReward: "ak-slate",
    skinIds: mixCase("street-economy", "ak-slate", 1.49, "starter"),
  }),
  makeCase({
    id: "night-operator",
    name: "Night Operator",
    price: 1.19,
    preset: "low-risk",
    tags: ["pistols", "cheap", "popular"],
    section: "starter",
    accent: "#818cf8",
    accent2: "#22d3ee",
    blurb: "Sidearm economy. Glocks, USPs, Deagles — still a cheap tape.",
    animationType: "rarity-reveal",
    featuredReward: "glock-vogue",
    skinIds: mixCase("night-operator", "glock-vogue", 1.19, "starter", {
      weapons: ["Glock-18", "USP-S", "Desert Eagle", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "P2000", "R8 Revolver"],
    }),
  }),
  makeCase({
    id: "carbon-edge",
    name: "Carbon Edge",
    price: 4.99,
    preset: "low-risk",
    tags: ["cheap", "rifles"],
    section: "starter",
    accent: "#64748b",
    accent2: "#22d3ee",
    blurb: "Industrial rifles and cheap scouts. Clean steel, honest odds.",
    animationType: "portal",
    featuredReward: "ak-redline",
    skinIds: mixCase("carbon-edge", "ak-redline", 4.99, "starter", {
      weapons: ["AK-47", "M4A4", "M4A1-S", "FAMAS", "Galil AR", "SSG 08", "SG 553", "AUG"],
    }),
  }),
  makeCase({
    id: "prism-core",
    name: "Prism Case",
    price: 8.99,
    preset: "standard",
    tags: ["popular", "new"],
    section: "starter",
    accent: "#2ee9ff",
    accent2: "#d946ef",
    blurb: "House signature crate. Mixed weapons, prism wrap — still starter money.",
    animationType: "roulette",
    popularity: 97,
    featuredReward: "m4-player",
    skinIds: mixCase("prism-core", "m4-player", 8.99, "starter"),
  }),
  makeCase({
    id: "arctic-case",
    name: "Arctic",
    price: 5.99,
    preset: "low-risk",
    tags: ["new", "rifles"],
    section: "budget",
    accent: "#e0f2fe",
    accent2: "#38bdf8",
    blurb: "Ice phosphor and glacier blues across rifles and USPs.",
    animationType: "core",
    featuredReward: "usp-print",
    skinIds: mixCase("arctic-case", "usp-print", 5.99, "budget"),
  }),
  makeCase({
    id: "neon-drift",
    name: "Neon Case",
    price: 12.99,
    preset: "standard",
    tags: ["popular", "rifles"],
    section: "budget",
    accent: "#22d3ee",
    accent2: "#818cf8",
    blurb: "Electric rifles and SMGs. Built for late-night sessions.",
    animationType: "vertical",
    popularity: 94,
    featuredReward: "ak-neon",
    skinIds: mixCase("neon-drift", "ak-neon", 12.99, "budget"),
  }),
  makeCase({
    id: "rush-hour",
    name: "Rush Hour",
    price: 8.99,
    preset: "standard",
    tags: ["popular", "cheap"],
    section: "budget",
    accent: "#38bdf8",
    accent2: "#f97316",
    blurb: "Close-range SMG pulse. MP9, MAC-10, P90 with rifle fillers.",
    animationType: "core",
    featuredReward: "p90-cold-blooded",
    skinIds: mixCase("rush-hour", "p90-cold-blooded", 8.99, "budget", {
      weapons: ["MP9", "MAC-10", "MP7", "MP5-SD", "PP-Bizon", "P90", "UMP-45"],
    }),
  }),
  makeCase({
    id: "glacier-drop",
    name: "Glacier Drop",
    price: 16.99,
    preset: "low-risk",
    tags: ["new", "rifles"],
    section: "budget",
    accent: "#67e8f9",
    accent2: "#38bdf8",
    blurb: "Cold-spectrum finishes. Printed steel and phosphor blues.",
    animationType: "core",
    featuredReward: "m4-hyper",
    skinIds: mixCase("glacier-drop", "m4-hyper", 16.99, "budget"),
  }),
  makeCase({
    id: "syndicate-black",
    name: "Syndicate Black",
    price: 11.99,
    preset: "standard",
    tags: ["new", "pistols"],
    section: "budget",
    accent: "#f43f5e",
    accent2: "#111827",
    blurb: "Covert prints and redline pistols from the night shift.",
    animationType: "carousel",
    featuredReward: "usp-kill",
    skinIds: mixCase("syndicate-black", "usp-kill", 11.99, "budget"),
  }),
  makeCase({
    id: "cyber-strike",
    name: "Cyber Strike",
    price: 5.49,
    preset: "standard",
    tags: ["rifles", "new"],
    section: "budget",
    accent: "#38bdf8",
    accent2: "#818cf8",
    blurb: "Digital camo and printstream-adjacent steel.",
    animationType: "vertical",
    featuredReward: "m4-asiimov",
    skinIds: mixCase("cyber-strike", "m4-asiimov", 5.49, "budget"),
  }),
  makeCase({
    id: "pulse-case",
    name: "Pulse",
    price: 24.99,
    preset: "standard",
    tags: ["popular"],
    section: "standard",
    accent: "#fb7185",
    accent2: "#22d3ee",
    blurb: "Heartbeat mid-pool. Bloodsport rifles sitting next to honest fillers.",
    animationType: "flip",
    featuredReward: "ak-bloodsport",
    skinIds: mixCase("pulse-case", "ak-bloodsport", 24.99, "standard"),
  }),
  makeCase({
    id: "chrome-case",
    name: "Chrome",
    price: 7.99,
    preset: "standard",
    tags: ["pistols"],
    section: "standard",
    accent: "#e5e7eb",
    accent2: "#22d3ee",
    blurb: "Printstream pistols and chrome Deagles. No $8k snipers.",
    animationType: "carousel",
    featuredReward: "deag-print",
    skinIds: mixCase("chrome-case", "deag-print", 7.99, "standard"),
  }),
  makeCase({
    id: "commando",
    name: "Commando",
    price: 6.49,
    preset: "low-risk",
    tags: ["rifles"],
    section: "standard",
    accent: "#a3e635",
    accent2: "#22d3ee",
    blurb: "FAMAS, Galil and work rifles — operator mid-stack.",
    animationType: "flip",
    featuredReward: "famas-commemoration",
    skinIds: mixCase("commando", "famas-commemoration", 6.49, "standard"),
  }),
  makeCase({
    id: "high-voltage",
    name: "Voltage Case",
    price: 8.49,
    preset: "high-risk",
    tags: ["high-risk", "rifles", "popular"],
    section: "standard",
    accent: "#facc15",
    accent2: "#f97316",
    blurb: "Swing crate. Most hits stay mid — a few fry the graph.",
    animationType: "carousel",
    featuredReward: "ak-asiimov",
    skinIds: mixCase("high-voltage", "ak-asiimov", 8.49, "standard"),
  }),
  makeCase({
    id: "awp-line",
    name: "Longshot",
    price: 79.99,
    preset: "high-risk",
    tags: ["high-risk"],
    section: "standard",
    accent: "#84cc16",
    accent2: "#14532d",
    blurb: "Scout-to-AWP corridor. Lightning Strike is the ceiling — Lore stays off this tape.",
    animationType: "roulette",
    featuredReward: "awp-lightning-strike",
    skinIds: mixCase("awp-line", "awp-lightning-strike", 79.99, "standard", {
      weapons: ["AWP", "SSG 08"],
    }),
  }),
  makeCase({
    id: "inferno-case",
    name: "Inferno",
    price: 109,
    preset: "high-risk",
    tags: ["high-risk"],
    section: "standard",
    accent: "#f97316",
    accent2: "#7f1d1d",
    blurb: "Blaze, Fire Serpent, Code Red. Standard-band ceiling.",
    animationType: "break",
    featuredReward: "ak-fire",
    skinIds: mixCase("inferno-case", "ak-fire", 109, "standard"),
  }),
  makeCase({
    id: "phantom-grip",
    name: "Phantom Grip",
    price: 349,
    preset: "standard",
    tags: ["gloves", "new"],
    section: "gloves",
    accent: "#c084fc",
    accent2: "#f59e0b",
    blurb: "Gloves only. Leather up to Fade — Pandora lives on the high-tier twin.",
    animationType: "vertical",
    featuredReward: "glove-fade",
    weapons: GLOVE_WEAPONS,
    skinIds: mixCase("phantom-grip", "glove-fade", 349, "gloves", { weapons: GLOVE_WEAPONS, gloves: true }),
  }),
  makeCase({
    id: "apex-protocol",
    name: "Apex Case",
    price: 289,
    preset: "high-risk",
    tags: ["knives", "high-risk", "popular"],
    section: "knives",
    accent: "#e879f9",
    accent2: "#22d3ee",
    blurb: "Knives only. Doppler Karambit is the marquee — Fade metals sit higher up the ladder.",
    animationType: "portal",
    popularity: 92,
    featuredReward: "kara-doppler",
    weapons: KNIFE_WEAPONS,
    skinIds: mixCase("apex-protocol", "kara-doppler", 289, "knives", { weapons: KNIFE_WEAPONS, knives: true }),
  }),
  makeCase({
    id: "eclipse-case",
    name: "Eclipse",
    price: 159,
    preset: "standard",
    tags: ["popular"],
    section: "premium",
    accent: "#0f172a",
    accent2: "#e14aff",
    blurb: "Premium mixed rifles, knives and gloves — Doppler steel on the wrap.",
    animationType: "carousel",
    featuredReward: "m4-print",
    skinIds: mixCase("eclipse-case", "m4-print", 159, "premium", { knives: true, gloves: true }),
  }),
  makeCase({
    id: "emerald-case",
    name: "Emerald",
    price: 569,
    preset: "high-risk",
    tags: ["knives"],
    section: "knives",
    accent: "#34d399",
    accent2: "#14532d",
    blurb: "Knives only. Gamma greens and Butterfly Doppler.",
    animationType: "core",
    featuredReward: "bfly-doppler",
    weapons: KNIFE_WEAPONS,
    skinIds: mixCase("emerald-case", "bfly-doppler", 569, "knives", { weapons: KNIFE_WEAPONS, knives: true }),
  }),
  makeCase({
    id: "mythic-overdrive",
    name: "Mythic Case",
    price: 239,
    preset: "jackpot",
    tags: ["high-risk", "knives"],
    section: "knives",
    accent: "#fb7185",
    accent2: "#fbbf24",
    blurb: "Knives only. Marble and Fade Karambit — Gungnir still waits in luxury.",
    animationType: "flip",
    featuredReward: "m9-marble",
    weapons: KNIFE_WEAPONS,
    skinIds: mixCase("mythic-overdrive", "m9-marble", 239, "knives", { weapons: KNIFE_WEAPONS, knives: true }),
  }),
  makeCase({
    id: "royal-case",
    name: "Royal",
    price: 389,
    preset: "jackpot",
    tags: ["high-risk", "popular"],
    section: "high-tier",
    accent: "#fbbf24",
    accent2: "#7c3aed",
    blurb: "Gilded vault. Gold Arabesque sits on the throne.",
    animationType: "rarity-reveal",
    popularity: 84,
    featuredReward: "ak-gold-arabesque",
    skinIds: mixCase("royal-case", "ak-gold-arabesque", 389, "high-tier", { knives: true, gloves: true }),
  }),
  makeCase({
    id: "phantom-case",
    name: "Phantom",
    price: 679,
    preset: "jackpot",
    tags: ["gloves", "new"],
    section: "gloves",
    accent: "#64748b",
    accent2: "#c084fc",
    blurb: "Gloves only. Pandora's Box is the advertised pull.",
    animationType: "rarity-reveal",
    featuredReward: "glove-pandora",
    weapons: GLOVE_WEAPONS,
    skinIds: mixCase("phantom-case", "glove-pandora", 679, "gloves", { weapons: GLOVE_WEAPONS, gloves: true }),
  }),
  makeCase({
    id: "titan-case",
    name: "Titan",
    price: 669,
    preset: "jackpot",
    tags: ["high-risk", "rifles"],
    section: "high-tier",
    accent: "#f8fafc",
    accent2: "#fbbf24",
    blurb: "Titan-class covert crush. M4A4 | Knight leads the card.",
    animationType: "rarity-reveal",
    featuredReward: "m4-knight",
    skinIds: mixCase("titan-case", "m4-knight", 669, "high-tier", { knives: true, gloves: true }),
  }),
  makeCase({
    id: "obsidian-case",
    name: "Obsidian",
    price: 309,
    preset: "jackpot",
    tags: ["high-risk", "knives"],
    section: "knives",
    accent: "#111827",
    accent2: "#e14aff",
    blurb: "Knives only. Karambit Fade is the featured cut.",
    animationType: "break",
    featuredReward: "kara-fade",
    weapons: KNIFE_WEAPONS,
    skinIds: mixCase("obsidian-case", "kara-fade", 309, "knives", { weapons: KNIFE_WEAPONS, knives: true }),
  }),
  makeCase({
    id: "overdrive-case",
    name: "Overdrive",
    price: 1499,
    preset: "jackpot",
    tags: ["high-risk"],
    section: "high-tier",
    accent: "#fb7185",
    accent2: "#22d3ee",
    blurb: "Turbo covert pool. Howl is the printed top drop.",
    animationType: "core",
    featuredReward: "m4-howl",
    skinIds: mixCase("overdrive-case", "m4-howl", 1499, "high-tier", { knives: true, gloves: true }),
  }),
  makeCase({
    id: "gold-rush",
    name: "Gold Rush",
    price: 469,
    preset: "jackpot",
    tags: ["high-risk", "knives", "popular"],
    section: "knives",
    accent: "#facc15",
    accent2: "#b45309",
    blurb: "Knives only. Butterfly Fade headlines a 40+ item gold ladder.",
    animationType: "flip",
    popularity: 80,
    featuredReward: "bfly-fade",
    weapons: KNIFE_WEAPONS,
    skinIds: mixCase("gold-rush", "bfly-fade", 469, "knives", { weapons: KNIFE_WEAPONS, knives: true }),
  }),
  makeCase({
    id: "zero-point",
    name: "Zero Point",
    price: 1719,
    preset: "jackpot",
    tags: ["high-risk", "knives", "gloves"],
    section: "luxury",
    accent: "#e14aff",
    accent2: "#2ee9ff",
    blurb: "End of the catalog. AWP | Gungnir is the configured top drop.",
    animationType: "rarity-reveal",
    popularity: 88,
    featuredReward: "awp-gungnir",
    skinIds: mixCase("zero-point", "awp-gungnir", 1719, "luxury", { knives: true, gloves: true }),
  }),
  makeCase({
    id: "dragon-vault",
    name: "Dragon Case",
    price: 1659,
    preset: "jackpot",
    tags: ["popular", "high-risk"],
    section: "luxury",
    accent: "#a3e635",
    accent2: "#f59e0b",
    blurb: "Dragon flagged luxury tape. AWP | Dragon Lore, with a real millipercent — not a fake 0.00%.",
    animationType: "break",
    popularity: 91,
    featuredReward: "awp-lore",
    skinIds: mixCase("dragon-vault", "awp-lore", 1659, "luxury", { knives: true, gloves: true }),
  }),
  makeCase({
    id: "usp-rack",
    name: "Silencer Rack",
    price: 7.49,
    preset: "low-risk",
    tags: ["pistols", "new", "popular"],
    section: "pistols",
    accent: "#67e8f9",
    accent2: "#94a3b8",
    blurb: "USP-S only. Forest Leaves through Printstream — no Glocks, no rifles.",
    animationType: "vertical",
    popularity: 93,
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "usp-print",
    weapons: ["USP-S"],
    skinIds: mixCase("usp-rack", "usp-print", 7.49, "pistols", { weapons: ["USP-S"] }),
  }),
  makeCase({
    id: "glock-tape",
    name: "Glock Tape",
    price: 5.99,
    preset: "low-risk",
    tags: ["pistols", "cheap", "new"],
    section: "pistols",
    accent: "#fb7185",
    accent2: "#f97316",
    blurb: "Glock-18 only — High Beam bulk through Bullet Queen. Fade stays off this cheap tape.",
    animationType: "rarity-reveal",
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "glock-bullet-queen",
    weapons: ["Glock-18"],
    skinIds: mixCase("glock-tape", "glock-bullet-queen", 5.99, "pistols", { weapons: ["Glock-18"] }),
  }),
  makeCase({
    id: "fifty-desert",
    name: "Fifty Desert",
    price: 7.99,
    preset: "standard",
    tags: ["pistols", "new"],
    section: "pistols",
    accent: "#e5e7eb",
    accent2: "#f59e0b",
    blurb: "Desert Eagle only. Mudder bulk, Printstream and Blaze on the ladder. No random rifles.",
    animationType: "carousel",
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "deag-print",
    weapons: ["Desert Eagle"],
    skinIds: mixCase("fifty-desert", "deag-print", 7.99, "pistols", { weapons: ["Desert Eagle"] }),
  }),
  makeCase({
    id: "kalash-vault",
    name: "Kalash Vault",
    price: 79.99,
    preset: "standard",
    tags: ["rifles", "new", "popular"],
    section: "rifles",
    accent: "#f97316",
    accent2: "#7f1d1d",
    blurb: "AK-47 only. Safari Mesh cheap tape, Redline on the wrap. Gold Arabesque stays off this crate.",
    animationType: "flip",
    popularity: 90,
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "ak-redline",
    weapons: ["AK-47"],
    skinIds: mixCase("kalash-vault", "ak-redline", 79.99, "rifles", { weapons: ["AK-47"] }),
  }),
  makeCase({
    id: "carbine-rack",
    name: "Carbine Rack",
    price: 12.99,
    preset: "standard",
    tags: ["rifles", "new"],
    section: "rifles",
    accent: "#22d3ee",
    accent2: "#a3e635",
    blurb: "M4A4 and M4A1-S only. Combined carbine catalog — Knight and Howl live higher.",
    animationType: "portal",
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "m4-player",
    weapons: ["M4A4", "M4A1-S"],
    skinIds: mixCase("carbine-rack", "m4-player", 12.99, "rifles", { weapons: ["M4A4", "M4A1-S"] }),
  }),
  makeCase({
    id: "scope-protocol",
    name: "Scope Protocol",
    price: 59.99,
    preset: "high-risk",
    tags: ["high-risk", "new"],
    section: "awp",
    accent: "#84cc16",
    accent2: "#38bdf8",
    blurb: "AWP only. Safari Mesh through Asiimov. SSG stays on Longshot; Lore stays in luxury.",
    animationType: "roulette",
    popularity: 89,
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "awp-asiimov",
    weapons: ["AWP"],
    skinIds: mixCase("scope-protocol", "awp-asiimov", 59.99, "awp", { weapons: ["AWP"] }),
  }),
  makeCase({
    id: "blade-vault",
    name: "Blade Vault",
    price: 229,
    preset: "jackpot",
    tags: ["knives", "high-risk", "new"],
    section: "knives",
    accent: "#e5e7eb",
    accent2: "#111827",
    blurb: "Knives only. Gut and Navaja bulk, Karambit Doppler on the wrap. No rifles padded in.",
    animationType: "break",
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "kara-doppler",
    weapons: KNIFE_WEAPONS,
    skinIds: mixCase("blade-vault", "kara-doppler", 229, "knives", { weapons: KNIFE_WEAPONS, knives: true }),
  }),
  makeCase({
    id: "grip-locker",
    name: "Grip Locker",
    price: 289,
    preset: "high-risk",
    tags: ["gloves", "new"],
    section: "gloves",
    accent: "#c084fc",
    accent2: "#34d399",
    blurb: "Gloves only. Racing Green and Transport bulk. Pandora stays on the high-tier twin.",
    animationType: "vertical",
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "glove-fade",
    weapons: ["Gloves"],
    skinIds: mixCase("grip-locker", "glove-fade", 289, "gloves", { weapons: ["Gloves"], gloves: true }),
  }),
  makeCase({
    id: "nova-case",
    name: "Nova",
    price: 1.29,
    preset: "low-risk",
    tags: ["cheap", "new"],
    section: "starter",
    accent: "#fde68a",
    accent2: "#f97316",
    blurb: "Another starter mix. Honest bulk next to a couple of mid rifles.",
    animationType: "core",
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "ak-elite",
    skinIds: mixCase("nova-case", "ak-elite", 1.29, "starter"),
  }),
  makeCase({
    id: "mirage-case",
    name: "Mirage",
    price: 9.49,
    preset: "standard",
    tags: ["new", "rifles"],
    section: "collections",
    accent: "#f59e0b",
    accent2: "#22d3ee",
    blurb: "Dust-lane collection crate. Mixed mid rifles and pistols — not a specialist tape.",
    animationType: "carousel",
    createdAt: Date.UTC(2026, 7, 16),
    featuredReward: "ak-inherit",
    skinIds: mixCase("mirage-case", "ak-inherit", 9.49, "collections"),
  }),
]);

export const CASE_MAP: Record<string, Crate> = Object.fromEntries(CASES.map((c) => [c.id, c]));

CASE_MAP["prism-case"] = CASE_MAP["prism-core"];
CASE_MAP["neon-case"] = CASE_MAP["neon-drift"];
CASE_MAP["voltage-case"] = CASE_MAP["high-voltage"];
CASE_MAP["apex-case"] = CASE_MAP["apex-protocol"];
CASE_MAP["mythic-case"] = CASE_MAP["mythic-overdrive"];
CASE_MAP["dragon-case"] = CASE_MAP["dragon-vault"];

export function getCase(id: string) {
  return CASE_MAP[id];
}

export function caseRange(crate: Crate) {
  const prices = crate.rewards.map((r) => {
    try {
      return requireMarketPrice(r.skinId);
    } catch {
      return r.value;
    }
  });
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

const HOME_CATEGORY_SECTIONS: Record<string, CaseSection[]> = {
  cases: [
    "starter",
    "budget",
    "standard",
    "premium",
    "high-tier",
    "luxury",
    "collections",
    "popular",
    "rare",
    "legendary",
    "new",
  ],
  weapons: ["pistols", "rifles", "awp"],
  knives: ["knives"],
  gloves: ["gloves"],
};

export function homeLane(section: CaseSection) {
  if (HOME_CATEGORY_SECTIONS.knives.includes(section)) return "knives";
  if (HOME_CATEGORY_SECTIONS.gloves.includes(section)) return "gloves";
  if (HOME_CATEGORY_SECTIONS.weapons.includes(section)) return "weapons";
  return "cases";
}

export function crateCategory(crate: Crate, key: string) {
  if (key === "all") return true;
  const grouped = HOME_CATEGORY_SECTIONS[key];
  if (grouped) return grouped.includes(crate.section);
  if (crate.section === key) return true;
  return crate.tags.includes(key as CaseTag);
}

export function topDrop(crate: Crate) {
  const id = crate.featuredReward;
  return crate.rewards.find((r) => r.skinId === id) ?? crate.rewards[0];
}
