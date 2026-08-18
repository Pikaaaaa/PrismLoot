import { CASES, KNIFE_WEAPONS } from "../data/cases";
import { SKIN_MAP } from "../data/skins";
import { calculateCaseEV } from "../lib/economy/ev";
import { rollCase } from "../lib/rewards/rewardEngine";

const samples = ["night-operator", "genesis-case", "dragon-vault", "usp-rack"] as const;
let holes = 0;

for (const id of samples) {
  const crate = CASES.find((c) => c.id === id);
  if (!crate) throw new Error(`missing ${id}`);
  if (crate.rewards.length < 22) throw new Error(`${id} has ${crate.rewards.length} rewards`);
  const pool = new Set(crate.rewards.map((r) => r.skinId));
  for (let i = 0; i < 200; i++) {
    const roll = rollCase(id);
    if (!pool.has(roll.skinId) || roll.item.id !== roll.skinId) {
      holes += 1;
      console.error("OUT", id, roll.skinId, roll.item.id);
    }
  }
  console.log(id, crate.rewards.length, "rewards · 200/200 in pool · featured", crate.featuredReward);
}

const constraints: Array<[string, string[]]> = [
  ["usp-rack", ["USP-S"]],
  ["glock-tape", ["Glock-18"]],
  ["fifty-desert", ["Desert Eagle"]],
  ["kalash-vault", ["AK-47"]],
  ["carbine-rack", ["M4A4", "M4A1-S"]],
  ["scope-protocol", ["AWP"]],
  ["grip-locker", ["Gloves"]],
  ["phantom-grip", ["Gloves"]],
  ["phantom-case", ["Gloves"]],
];

for (const [id, weapons] of constraints) {
  const crate = CASES.find((c) => c.id === id);
  if (!crate) throw new Error(`missing ${id}`);
  const allow = new Set(weapons);
  for (const row of crate.rewards) {
    const w = SKIN_MAP[row.skinId]?.weapon;
    if (!w || !allow.has(w)) throw new Error(`${id} leaked ${row.skinId} (${w})`);
  }
  for (let i = 0; i < 200; i++) {
    const roll = rollCase(id);
    const w = SKIN_MAP[roll.skinId]?.weapon;
    if (!w || !allow.has(w)) {
      holes += 1;
      console.error("WEAPON", id, roll.skinId, w);
    }
  }
  console.log(id, "200/200", weapons.join("/"));
}

const knifeSet = new Set(KNIFE_WEAPONS);
for (let i = 0; i < 200; i++) {
  const roll = rollCase("blade-vault");
  const w = SKIN_MAP[roll.skinId]?.weapon;
  if (!w || !knifeSet.has(w)) {
    holes += 1;
    console.error("NOT KNIFE", roll.skinId, w);
  }
}
console.log("blade-vault 200/200 knives");

for (const id of ["blade-vault", "apex-protocol", "obsidian-case", "gold-rush"] as const) {
  const crate = CASES.find((c) => c.id === id);
  if (!crate) throw new Error(`missing ${id}`);
  console.log(id, crate.rewards.length, "knife-pool rewards");
  if (crate.rewards.length < 22) throw new Error(`${id} thin pool ${crate.rewards.length}`);
  for (const row of crate.rewards) {
    const w = SKIN_MAP[row.skinId]?.weapon;
    if (!w || !knifeSet.has(w)) throw new Error(`${id} leaked ${row.skinId} (${w})`);
  }
}

for (const id of ["grip-locker", "phantom-grip", "phantom-case"] as const) {
  const crate = CASES.find((c) => c.id === id);
  if (!crate) throw new Error(`missing ${id}`);
  console.log(id, crate.rewards.length, "glove-pool rewards");
  if (crate.rewards.length < 22) throw new Error(`${id} thin pool ${crate.rewards.length}`);
}

const over = CASES.filter((c) => {
  const ev = calculateCaseEV(c);
  return !(c.rtp < 1) || !(ev < c.price);
});
if (over.length) throw new Error(`RTP ≥ 100%: ${over.map((c) => c.id).join(",")}`);

if (holes) throw new Error(`${holes} opens landed outside crate.rewards`);
console.log("OK", CASES.length, "cases — drops ∉ pool are impossible");
