import { CASES as RAW_CASES, CASE_MAP as RAW_CASE_MAP, caseRange, crateCategory, homeLane, topDrop } from "@/data/cases";
import { CURRENT_USER, DEMO_USERS } from "@/data/demo-users";
import { SKINS, SKIN_MAP } from "@/data/skins";
import { withCaseArt } from "@/lib/case-art";
import { uniqueCrates } from "@/lib/ui/catalog";
import type { Battle, PublicUser, Skin } from "./types";

export const CASES = uniqueCrates(RAW_CASES.map((crate) => withCaseArt(crate)));
export const CASE_MAP: typeof RAW_CASE_MAP = Object.fromEntries(
  Object.entries(RAW_CASE_MAP).map(([id, crate]) => [id, crate ? withCaseArt(crate) : crate]),
);

export { caseRange, crateCategory, CURRENT_USER, homeLane, SKINS, SKIN_MAP, topDrop };

export const BOT_USERS: PublicUser[] = DEMO_USERS;

export const LIVE_NAMES = BOT_USERS.map((u) => u.username);

export function makeBattles(): Battle[] {
  const player = (user: PublicUser): Battle["players"][number] => ({
    user,
    ready: true,
    winnings: [],
    total: 0,
  });

  return [
    {
      id: "b1",
      mode: "1v1",
      status: "waiting",
      cost: 13.98,
      caseIds: ["neon-drift", "neon-drift"],
      slots: 2,
      players: [player(BOT_USERS[0])],
    },
    {
      id: "b2",
      mode: "1v1",
      status: "waiting",
      cost: 4998,
      caseIds: ["dragon-vault", "dragon-vault"],
      slots: 2,
      players: [player(BOT_USERS[2])],
    },
    {
      id: "b3",
      mode: "2v2",
      status: "waiting",
      cost: 19.98,
      caseIds: ["prism-core", "glacier-drop", "prism-core", "glacier-drop"],
      slots: 4,
      players: [player(BOT_USERS[4]), player(BOT_USERS[5])],
    },
    {
      id: "b4",
      mode: "ffa",
      status: "waiting",
      cost: 6.45,
      caseIds: ["night-operator", "street-economy", "night-operator"],
      slots: 3,
      players: [player(BOT_USERS[7])],
    },
    {
      id: "b5",
      mode: "3v3",
      status: "waiting",
      cost: 79,
      caseIds: ["phantom-grip", "apex-protocol", "eclipse-case"],
      slots: 6,
      players: [player(BOT_USERS[8]), player(BOT_USERS[9]), player(BOT_USERS[10])],
    },
    {
      id: "b6",
      mode: "1v1",
      status: "live",
      cost: 1198,
      caseIds: ["titan-case", "overdrive-case"],
      slots: 2,
      players: [player(BOT_USERS[6]), player(BOT_USERS[3])],
    },
    {
      id: "b7",
      mode: "ffa",
      status: "finished",
      cost: 14.97,
      caseIds: ["carbon-edge", "neon-drift", "prism-core"],
      slots: 3,
      players: [player(BOT_USERS[1]), player(BOT_USERS[11]), player(BOT_USERS[2])],
      winnerId: BOT_USERS[2].id,
    },
  ];
}

export const STARTING_INVENTORY_IDS: Array<{
  skinId: string;
  wear: Skin["wear"];
  stattrak: boolean;
}> = [
  { skinId: "ak-neon", wear: "mw", stattrak: true },
  { skinId: "awp-asiimov", wear: "ft", stattrak: false },
  { skinId: "m4-hyper", wear: "mw", stattrak: false },
  { skinId: "usp-print", wear: "ft", stattrak: false },
  { skinId: "deag-code", wear: "ww", stattrak: true },
  { skinId: "glock-vogue", wear: "ft", stattrak: false },
  { skinId: "ak-redline", wear: "mw", stattrak: false },
  { skinId: "kara-night", wear: "bs", stattrak: false },
  { skinId: "glove-mint", wear: "mw", stattrak: false },
  { skinId: "awp-neonoir", wear: "ft", stattrak: false },
  { skinId: "m4-player", wear: "ww", stattrak: false },
  { skinId: "glock-water", wear: "fn", stattrak: true },
  { skinId: "glock-sand", wear: "ft", stattrak: false },
  { skinId: "glock-sand", wear: "ww", stattrak: false },
  { skinId: "glock-sand", wear: "bs", stattrak: false },
  { skinId: "usp-leaves", wear: "mw", stattrak: false },
  { skinId: "awp-safari", wear: "ft", stattrak: false },
  { skinId: "deag-urban", wear: "fn", stattrak: false },
];

export const NAV_MAIN = [
  { href: "/", label: "Home" },
  { href: "/upgrade", label: "Upgrade" },
  { href: "/contracts", label: "Contracts" },
] as const;

export const NAV_MORE = [] as const;
