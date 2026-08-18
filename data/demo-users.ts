import type { PublicUser } from "@/lib/types";

export const CURRENT_USER: PublicUser = {
  id: "u_novaprime",
  username: "NovaPrime",
  avatarHue: 186,
  level: 47,
  email: null,
};

/** Fictional demo stream only — 40 nicks, no real player PII. */
export const DEMO_USERS: PublicUser[] = [
  { id: "u1", username: "ShadowWolf", avatarHue: 12, level: 61 },
  { id: "u2", username: "NightFury", avatarHue: 262, level: 44 },
  { id: "u3", username: "ApexNova", avatarHue: 198, level: 72 },
  { id: "u4", username: "GhostBlade", avatarHue: 140, level: 38 },
  { id: "u5", username: "VenomIQ", avatarHue: 92, level: 55 },
  { id: "u6", username: "FrostByte", avatarHue: 200, level: 29 },
  { id: "u7", username: "RogueAsh", avatarHue: 18, level: 81 },
  { id: "u8", username: "KillSwitch", avatarHue: 330, level: 50 },
  { id: "u9", username: "LunaHex", avatarHue: 280, level: 66 },
  { id: "u10", username: "ZeroProtocol", avatarHue: 160, level: 41 },
  { id: "u11", username: "Polaris", avatarHue: 220, level: 58 },
  { id: "u12", username: "DriftKing", avatarHue: 48, level: 33 },
  { id: "u13", username: "IrisVolt", avatarHue: 174, level: 27 },
  { id: "u14", username: "CobaltRain", avatarHue: 206, level: 52 },
  { id: "u15", username: "HexMoth", avatarHue: 312, level: 46 },
  { id: "u16", username: "SatinGrid", avatarHue: 268, level: 39 },
  { id: "u17", username: "NyxPulse", avatarHue: 286, level: 63 },
  { id: "u18", username: "RookieTape", avatarHue: 24, level: 12 },
  { id: "u19", username: "ChromeHawk", avatarHue: 210, level: 57 },
  { id: "u20", username: "VioletSaw", avatarHue: 276, level: 48 },
  { id: "u21", username: "OrbitDust", avatarHue: 194, level: 31 },
  { id: "u22", username: "BrineOp", avatarHue: 164, level: 44 },
  { id: "u23", username: "SolarKite", avatarHue: 36, level: 22 },
  { id: "u24", username: "AshCircuit", avatarHue: 8, level: 70 },
  { id: "u25", username: "MiraGlass", avatarHue: 188, level: 35 },
  { id: "u26", username: "Nocturne", avatarHue: 250, level: 77 },
  { id: "u27", username: "PistonKid", avatarHue: 20, level: 19 },
  { id: "u28", username: "JadeWrench", avatarHue: 142, level: 43 },
  { id: "u29", username: "EchoMint", avatarHue: 158, level: 28 },
  { id: "u30", username: "ScarletBit", avatarHue: 352, level: 60 },
  { id: "u31", username: "QuasarFox", avatarHue: 214, level: 54 },
  { id: "u32", username: "TundraRex", avatarHue: 190, level: 41 },
  { id: "u33", username: "NebulaJay", avatarHue: 226, level: 36 },
  { id: "u34", username: "VoltHarbor", avatarHue: 178, level: 49 },
  { id: "u35", username: "PinkLatency", avatarHue: 318, level: 26 },
  { id: "u36", username: "BlackOrbit", avatarHue: 240, level: 68 },
  { id: "u37", username: "CinderOwl", avatarHue: 16, level: 45 },
  { id: "u38", username: "AquaRift", avatarHue: 182, level: 34 },
  { id: "u39", username: "PrismOtter", avatarHue: 172, level: 21 },
  { id: "u40", username: "GildedWisp", avatarHue: 42, level: 88 },
];

export const DEMO_USER_MAP: Record<string, PublicUser> = Object.fromEntries(
  [CURRENT_USER, ...DEMO_USERS].map((u) => [u.id, u]),
);
