import type { Crate } from "@/lib/types";

export const CASE_ASSET_EXTS = ["png", "webp", "svg"] as const;
export const CASE_FALLBACK_ID = "_fallback";

const THEMES: Record<string, string> = {
  "prism-core": "prism",
  "neon-drift": "neon-grid",
  "high-voltage": "voltage",
  "apex-protocol": "apex",
  "mythic-overdrive": "mythic",
  "dragon-vault": "dragon",
  "glacier-drop": "glacier",
  "night-operator": "operator",
  "street-economy": "street",
  "phantom-grip": "phantom-grip",
  "syndicate-black": "syndicate",
  "carbon-edge": "carbon",
  "neon-rush": "neon-rush",
  "cyber-strike": "cyber",
  "purple-haze": "haze",
  "inferno-case": "inferno",
  "arctic-case": "arctic",
  "phantom-case": "ghost",
  "blood-moon": "blood-moon",
  eclipse: "eclipse",
  "eclipse-case": "eclipse",
  "spectrum-case": "spectrum",
  "galaxy-case": "galaxy",
  "shadow-case": "shadow",
  "royal-case": "royal",
  "emerald-case": "emerald",
  "ruby-case": "ruby",
  "sapphire-case": "sapphire",
  "gold-rush": "gold-vault",
  "nightfall-case": "nightfall",
  "overdrive-case": "overdrive",
  "terminal-case": "terminal",
  "quantum-case": "quantum",
  "vortex-case": "vortex",
  "obsidian-case": "obsidian",
  "genesis-case": "genesis",
  "titan-case": "titan",
  "nova-case": "nova",
  "velocity-case": "velocity",
  "awp-line": "longshot",
  "chrome-case": "chrome",
  "magma-case": "magma",
  "lotus-case": "lotus",
  "mirage-case": "mirage",
  "pulse-case": "pulse",
  "hex-case": "hex",
  "meteor-case": "meteor",
  "storm-case": "storm",
  "aurora-case": "aurora",
  "ivory-case": "ivory",
  "zero-point": "singularity",
  slingshot: "slingshot",
  commando: "commando",
  "rush-hour": "city",
  "fracture-line": "fracture",
  "usp-rack": "spectrum",
  "glock-tape": "nightfall",
  "fifty-desert": "ivory",
  "kalash-vault": "magma",
  "carbine-rack": "terminal",
  "scope-protocol": "velocity",
  "blade-vault": "shadow",
  "grip-locker": "lotus",
};

export function caseAssetDir(id: string) {
  return `/assets/cases/${id}`;
}

export function caseArtPaths(id: string) {
  const base = caseAssetDir(id);
  return {
    image: `${base}/case.png`,
    thumbnail: `${base}/thumbnail.png`,
    background: `${base}/background.png`,
    theme: THEMES[id] ?? "vault",
  };
}

export function fallbackArtPaths() {
  return caseArtPaths(CASE_FALLBACK_ID);
}

/** Prefer PNG when present; fall back to SVG on the same case folder if PNG 404s. */
export function nextCaseArtCandidate(src: string | undefined) {
  if (!src) return undefined;
  if (/\.png$/i.test(src)) return src.replace(/\.png$/i, ".svg");
  if (/\.webp$/i.test(src)) return src.replace(/\.webp$/i, ".png");
  return undefined;
}

export function isCaseAssetPath(value: string | undefined) {
  return !!value && value.startsWith("/assets/cases/") && !value.includes("undefined");
}

/** Overlay unique crate artwork onto a case record without touching loot/RTP. */
export function withCaseArt<T extends Pick<Crate, "id" | "theme" | "section">>(crate: T): T & {
  image: string;
  thumbnail: string;
  background: string;
  theme: string;
} {
  const art = caseArtPaths(crate.id);
  return {
    ...crate,
    image: art.image,
    thumbnail: art.thumbnail,
    background: art.background,
    theme: THEMES[crate.id] ?? crate.theme ?? crate.section ?? "vault",
  };
}
