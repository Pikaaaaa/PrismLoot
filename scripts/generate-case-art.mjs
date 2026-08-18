#!/usr/bin/env node
/**
 * Unique PrismLoot case artwork generator.
 * Writes /public/assets/cases/{id}/{case,thumbnail,background}.svg
 * Each crate uses a distinct silhouette + motif drawn into the asset (not CSS).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/assets/cases");

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `#${[ch(16), ch(8), ch(0)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** @type {Array<{
 *   id: string; name: string; plat: string; a: string; b: string;
 *   body: string; motif: string; premium: boolean; scene: string;
 * }>} */
const SPECS = [
  { id: "prism-core", name: "Prism Case", plat: "PL", a: "#2ee9ff", b: "#d946ef", body: "hex", motif: "prism", premium: false, scene: "studio-prism" },
  { id: "neon-drift", name: "Neon Case", plat: "N", a: "#22d3ee", b: "#818cf8", body: "weapon", motif: "tubes", premium: false, scene: "neon-grid" },
  { id: "high-voltage", name: "Voltage Case", plat: "V", a: "#facc15", b: "#f97316", body: "armored", motif: "lightning", premium: true, scene: "storm" },
  { id: "apex-protocol", name: "Apex Case", plat: "AX", a: "#e879f9", b: "#22d3ee", body: "pyramid", motif: "blade", premium: true, scene: "protocol" },
  { id: "mythic-overdrive", name: "Mythic Case", plat: "MY", a: "#fb7185", b: "#fbbf24", body: "orbCage", motif: "cosmic", premium: true, scene: "nebula" },
  { id: "dragon-vault", name: "Dragon Case", plat: "DR", a: "#ef4444", b: "#fbbf24", body: "relic", motif: "dragon", premium: true, scene: "lair" },
  { id: "glacier-drop", name: "Glacier Drop", plat: "GL", a: "#67e8f9", b: "#38bdf8", body: "ice", motif: "iceberg", premium: false, scene: "glacier" },
  { id: "night-operator", name: "Night Operator", plat: "NO", a: "#818cf8", b: "#1e1b4b", body: "ammo", motif: "crosshair", premium: false, scene: "nightops" },
  { id: "street-economy", name: "Street Economy", plat: "ST", a: "#94a3b8", b: "#f59e0b", body: "weapon", motif: "graffiti", premium: false, scene: "alley" },
  { id: "phantom-grip", name: "Phantom Grip", plat: "PG", a: "#c084fc", b: "#22d3ee", body: "capsule", motif: "glove", premium: true, scene: "phantom" },
  { id: "syndicate-black", name: "Syndicate Black", plat: "SB", a: "#f43f5e", b: "#111827", body: "coffin", motif: "sigil", premium: false, scene: "syndicate" },
  { id: "carbon-edge", name: "Carbon Edge", plat: "C", a: "#64748b", b: "#22d3ee", body: "armored", motif: "fiber", premium: false, scene: "carbon" },
  { id: "neon-rush", name: "Neon Rush", plat: "NR", a: "#22d3ee", b: "#ec4899", body: "canister", motif: "energy", premium: false, scene: "rush" },
  { id: "cyber-strike", name: "Cyber Strike", plat: "CS", a: "#38bdf8", b: "#a3e635", body: "terminal", motif: "circuit", premium: false, scene: "cyber" },
  { id: "purple-haze", name: "Purple Haze", plat: "PH", a: "#c084fc", b: "#818cf8", body: "capsule", motif: "smoke", premium: false, scene: "haze" },
  { id: "inferno-case", name: "Inferno", plat: "IN", a: "#f97316", b: "#ef4444", body: "urn", motif: "flame", premium: true, scene: "inferno" },
  { id: "arctic-case", name: "Arctic", plat: "AR", a: "#e0f2fe", b: "#38bdf8", body: "ice", motif: "snowflake", premium: false, scene: "arctic" },
  { id: "phantom-case", name: "Phantom", plat: "PH", a: "#94a3b8", b: "#c084fc", body: "glass", motif: "ghost", premium: false, scene: "ghost" },
  { id: "blood-moon", name: "Blood Moon", plat: "BM", a: "#9f1239", b: "#f97316", body: "orbCage", motif: "moon", premium: true, scene: "bloodmoon" },
  { id: "eclipse-case", name: "Eclipse", plat: "EC", a: "#0f172a", b: "#fbbf24", body: "diamond", motif: "eclipse", premium: false, scene: "eclipse" },
  { id: "spectrum-case", name: "Spectrum", plat: "SP", a: "#f472b6", b: "#22d3ee", body: "hex", motif: "spectrum", premium: false, scene: "spectrum" },
  { id: "galaxy-case", name: "Galaxy", plat: "GX", a: "#6366f1", b: "#e879f9", body: "orbCage", motif: "galaxy", premium: false, scene: "galaxy" },
  { id: "shadow-case", name: "Shadow", plat: "SH", a: "#1e293b", b: "#64748b", body: "coffin", motif: "shadow", premium: false, scene: "shadow" },
  { id: "royal-case", name: "Royal", plat: "RY", a: "#fbbf24", b: "#f59e0b", body: "relic", motif: "crown", premium: true, scene: "palace" },
  { id: "emerald-case", name: "Emerald", plat: "EM", a: "#34d399", b: "#059669", body: "crystal", motif: "gem", premium: true, scene: "emerald" },
  { id: "ruby-case", name: "Ruby", plat: "RB", a: "#e11d48", b: "#fb7185", body: "diamond", motif: "ruby", premium: true, scene: "ruby" },
  { id: "sapphire-case", name: "Sapphire", plat: "SA", a: "#2563eb", b: "#22d3ee", body: "hex", motif: "sapphire", premium: false, scene: "sapphire" },
  { id: "gold-rush", name: "Gold Rush", plat: "AU", a: "#facc15", b: "#b45309", body: "relic", motif: "ingot", premium: true, scene: "vault" },
  { id: "nightfall-case", name: "Nightfall", plat: "NF", a: "#1e1b4b", b: "#818cf8", body: "weapon", motif: "crescent", premium: false, scene: "nightfall" },
  { id: "overdrive-case", name: "Overdrive", plat: "OV", a: "#fb7185", b: "#f97316", body: "canister", motif: "engine", premium: true, scene: "overdrive" },
  { id: "terminal-case", name: "Terminal", plat: "TM", a: "#94a3b8", b: "#22d3ee", body: "terminal", motif: "prompt", premium: false, scene: "terminal" },
  { id: "quantum-case", name: "Quantum", plat: "Q", a: "#22d3ee", b: "#e879f9", body: "orbCage", motif: "atom", premium: true, scene: "quantum" },
  { id: "vortex-case", name: "Vortex", plat: "VX", a: "#7c3aed", b: "#22d3ee", body: "spiral", motif: "vortex", premium: false, scene: "vortex" },
  { id: "obsidian-case", name: "Obsidian", plat: "OB", a: "#6d28d9", b: "#111827", body: "crystal", motif: "shard", premium: true, scene: "obsidian" },
  { id: "genesis-case", name: "Genesis", plat: "GN", a: "#67e8f9", b: "#34d399", body: "urn", motif: "seed", premium: false, scene: "genesis" },
  { id: "titan-case", name: "Titan", plat: "TT", a: "#f8fafc", b: "#64748b", body: "armored", motif: "titan", premium: true, scene: "titan" },
  { id: "nova-case", name: "Nova", plat: "NV", a: "#fde68a", b: "#f97316", body: "diamond", motif: "burst", premium: false, scene: "nova" },
  { id: "velocity-case", name: "Velocity", plat: "VL", a: "#2ee9ff", b: "#38bdf8", body: "sniper", motif: "speed", premium: false, scene: "velocity" },
  { id: "awp-line", name: "Longshot", plat: "AW", a: "#84cc16", b: "#14532d", body: "sniper", motif: "scope", premium: true, scene: "longshot" },
  { id: "chrome-case", name: "Chrome", plat: "CR", a: "#e5e7eb", b: "#67e8f9", body: "glass", motif: "chrome", premium: false, scene: "chrome" },
  { id: "magma-case", name: "Magma", plat: "MG", a: "#ea580c", b: "#7c2d12", body: "urn", motif: "lava", premium: true, scene: "magma" },
  { id: "lotus-case", name: "Lotus", plat: "LT", a: "#86efac", b: "#c084fc", body: "urn", motif: "lotus", premium: false, scene: "lotus" },
  { id: "mirage-case", name: "Mirage", plat: "MR", a: "#fde68a", b: "#f59e0b", body: "pyramid", motif: "dunes", premium: false, scene: "mirage" },
  { id: "pulse-case", name: "Pulse", plat: "PU", a: "#fb7185", b: "#22d3ee", body: "canister", motif: "pulse", premium: false, scene: "pulse" },
  { id: "hex-case", name: "Hex", plat: "HX", a: "#c084fc", b: "#22d3ee", body: "hex", motif: "hexseal", premium: true, scene: "hex" },
  { id: "meteor-case", name: "Meteor", plat: "MT", a: "#fdba74", b: "#7c2d12", body: "cracked", motif: "meteor", premium: true, scene: "meteor" },
  { id: "storm-case", name: "Storm", plat: "SR", a: "#64748b", b: "#38bdf8", body: "weapon", motif: "thunder", premium: false, scene: "stormfront" },
  { id: "aurora-case", name: "Aurora", plat: "AU", a: "#67e8f9", b: "#a3e635", body: "ice", motif: "aurora", premium: false, scene: "aurora" },
  { id: "ivory-case", name: "Ivory", plat: "IV", a: "#fef3c7", b: "#d6d3d1", body: "relic", motif: "ivory", premium: false, scene: "ivory" },
  { id: "zero-point", name: "Zero Point", plat: "ZP", a: "#e14aff", b: "#2ee9ff", body: "orbCage", motif: "singularity", premium: true, scene: "singularity" },
  { id: "slingshot", name: "Slingshot", plat: "SL", a: "#f43f5e", b: "#fb923c", body: "weapon", motif: "arrow", premium: false, scene: "sling" },
  { id: "commando", name: "Commando", plat: "CM", a: "#a3e635", b: "#3f6212", body: "ammo", motif: "stencil", premium: false, scene: "commando" },
  { id: "rush-hour", name: "Rush Hour", plat: "RH", a: "#38bdf8", b: "#fbbf24", body: "terminal", motif: "skyline", premium: false, scene: "city" },
  { id: "fracture-line", name: "Fracture", plat: "FR", a: "#c084fc", b: "#fb7185", body: "cracked", motif: "fracture", premium: false, scene: "fracture" },
];

function uid(spec, key) {
  return `${spec.id.replace(/[^a-z0-9]/g, "")}-${key}`;
}

function motifSvg(spec, cx, cy, s) {
  const a = spec.a;
  const b = spec.b;
  const id = uid(spec, "m");
  switch (spec.motif) {
    case "prism":
      return `<polygon points="${cx},${cy - s} ${cx + s * 0.9},${cy - s * 0.2} ${cx + s * 0.55},${cy + s * 0.9} ${cx - s * 0.55},${cy + s * 0.9} ${cx - s * 0.9},${cy - s * 0.2}" fill="url(#${id}g)" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
        <polygon points="${cx},${cy - s * 0.55} ${cx + s * 0.38},${cy} ${cx},${cy + s * 0.45} ${cx - s * 0.38},${cy}" fill="#fff" fill-opacity=".28"/>`;
    case "tubes":
      return Array.from({ length: 5 }, (_, i) => {
        const x = cx - s + i * (s * 0.48);
        return `<rect x="${x}" y="${cy - s}" width="${s * 0.22}" height="${s * 2}" rx="4" fill="${i % 2 ? a : b}" opacity=".95"/>`;
      }).join("");
    case "lightning":
      return `<polyline points="${cx + 4},${cy - s} ${cx - s * 0.2},${cy - 4} ${cx + s * 0.15},${cy - 4} ${cx - 8},${cy + s}" fill="none" stroke="${a}" stroke-width="${s * 0.18}" stroke-linejoin="round" stroke-linecap="round"/>
        <polyline points="${cx},${cy - s * 0.7} ${cx - s * 0.12},${cy - 10} ${cx + s * 0.1},${cy - 10} ${cx - 2},${cy + s * 0.55}" fill="none" stroke="#fff" stroke-width="3"/>`;
    case "blade":
      return `<path d="M${cx - s * 0.15} ${cy + s} L${cx} ${cy - s} L${cx + s * 0.15} ${cy + s} Z" fill="${a}" stroke="#fff" stroke-width="1.5"/>
        <ellipse cx="${cx}" cy="${cy + s * 0.55}" rx="${s * 0.42}" ry="${s * 0.16}" fill="${b}" opacity=".8"/>`;
    case "cosmic":
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.55}" fill="none" stroke="${a}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.28}" fill="${b}"/>
        <path d="M${cx - s} ${cy} Q${cx} ${cy - s} ${cx + s} ${cy} Q${cx} ${cy + s} ${cx - s} ${cy}" fill="none" stroke="#fff" stroke-opacity=".5"/>`;
    case "dragon":
      return `<path d="M${cx - s * 0.7} ${cy + s * 0.35} Q${cx - s} ${cy - s * 0.4} ${cx - 10} ${cy - s * 0.7} Q${cx + 20} ${cy - s} ${cx + s * 0.15} ${cy - s * 0.2} Q${cx + s * 0.85} ${cy - s * 0.55} ${cx + s * 0.9} ${cy + 8} Q${cx + s * 0.2} ${cy + s * 0.2} ${cx} ${cy + s * 0.55} Q${cx - s * 0.4} ${cy + s * 0.7} ${cx - s * 0.7} ${cy + s * 0.35}" fill="${a}" stroke="${b}" stroke-width="2.5"/>
        <circle cx="${cx - s * 0.12}" cy="${cy - s * 0.22}" r="5" fill="#fff"/>
        <path d="M${cx + s * 0.2} ${cy + 4} Q${cx + s} ${cy + s * 0.5} ${cx + s * 0.45} ${cy + s * 0.85}" fill="none" stroke="${b}" stroke-width="4"/>`;
    case "iceberg":
      return `<polygon points="${cx},${cy - s} ${cx + s * 0.85},${cy + s * 0.15} ${cx + s * 0.4},${cy + s} ${cx - s * 0.45},${cy + s} ${cx - s * 0.9},${cy}" fill="${a}" fill-opacity=".85" stroke="#fff" stroke-width="2"/>
        <polygon points="${cx},${cy - s * 0.35} ${cx + s * 0.35},${cy + 10} ${cx - s * 0.2},${cy + 18}" fill="#fff" opacity=".45"/>`;
    case "crosshair":
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.62}" fill="none" stroke="${a}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.18}" fill="none" stroke="${b}" stroke-width="2"/>
        <path d="M${cx} ${cy - s} V${cy - s * 0.28} M${cx} ${cy + s * 0.28} V${cy + s} M${cx - s} ${cy} H${cx - s * 0.28} M${cx + s * 0.28} ${cy} H${cx + s}" stroke="#fff" stroke-width="2"/>`;
    case "graffiti":
      return `<path d="M${cx - s} ${cy + s * 0.4} C${cx - s * 0.2} ${cy - s},${cx + s * 0.4} ${cy - s * 0.2},${cx + s} ${cy + s * 0.2}" fill="none" stroke="${a}" stroke-width="${s * 0.28}" stroke-linecap="round"/>
        <path d="M${cx - s * 0.7} ${cy + s * 0.7} C${cx} ${cy},${cx + s * 0.2} ${cy + s * 0.4},${cx + s * 0.75} ${cy - s * 0.15}" fill="none" stroke="${b}" stroke-width="${s * 0.16}"/>`;
    case "glove":
      return `<path d="M${cx - s * 0.45} ${cy + s * 0.7} Q${cx - s * 0.7} ${cy} ${cx - s * 0.2} ${cy - s * 0.55} Q${cx} ${cy - s} ${cx + s * 0.25} ${cy - s * 0.4} Q${cx + s * 0.7} ${cy - s * 0.7} ${cx + s * 0.55} ${cy} L${cx + s * 0.35} ${cy + s * 0.75} Z" fill="${a}" stroke="#fff" stroke-width="2" opacity=".92"/>
        <path d="M${cx - s * 0.05} ${cy - s * 0.1} Q${cx + s * 0.35} ${cy + 10} ${cx + 8} ${cy + s * 0.45}" fill="none" stroke="#fff" stroke-width="3"/>`;
    case "sigil":
      return `<path d="M${cx} ${cy - s} L${cx + s * 0.72} ${cy + s * 0.55} H${cx - s * 0.72} Z" fill="none" stroke="${a}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy + 6}" r="${s * 0.28}" fill="${b}"/>
        <path d="M${cx - 10} ${cy + 6} L${cx} ${cy - 18} L${cx + 10} ${cy + 6} Z" fill="#111"/>`;
    case "fiber":
      return Array.from({ length: 9 }, (_, i) => `<path d="M${cx - s} ${cy - s + i * s * 0.24} Q${cx} ${cy - s * 0.4 + i * 8},${cx + s} ${cy - s + ((i * 17) % 40)}" fill="none" stroke="${i % 2 ? a : b}" stroke-width="2" opacity=".8"/>`).join("");
    case "energy":
      return `<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.85}" ry="${s * 0.38}" fill="none" stroke="${a}" stroke-width="4"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${s * 0.38}" ry="${s * 0.85}" fill="none" stroke="${b}" stroke-width="4"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.2}" fill="#fff"/>`;
    case "circuit":
      return `<rect x="${cx - s * 0.7}" y="${cy - s * 0.7}" width="${s * 1.4}" height="${s * 1.4}" rx="8" fill="none" stroke="${a}" stroke-width="3"/>
        <circle cx="${cx - s * 0.35}" cy="${cy}" r="6" fill="${b}"/>
        <circle cx="${cx + s * 0.4}" cy="${cy - s * 0.25}" r="5" fill="${a}"/>
        <path d="M${cx - s * 0.35} ${cy} H${cx} V${cy - s * 0.25} H${cx + s * 0.4} M${cx} ${cy} V${cy + s * 0.45} H${cx + s * 0.55}" fill="none" stroke="${b}" stroke-width="3"/>`;
    case "smoke":
      return `<ellipse cx="${cx}" cy="${cy + s * 0.15}" rx="${s * 0.7}" ry="${s * 0.4}" fill="${a}" opacity=".7"/>
        <ellipse cx="${cx - s * 0.25}" cy="${cy - s * 0.25}" rx="${s * 0.42}" ry="${s * 0.32}" fill="${b}" opacity=".6"/>
        <ellipse cx="${cx + s * 0.3}" cy="${cy - s * 0.4}" rx="${s * 0.35}" ry="${s * 0.28}" fill="#fff" opacity=".25"/>`;
    case "flame":
      return `<path d="M${cx} ${cy + s} C${cx - s} ${cy + s * 0.2},${cx - s * 0.55} ${cy - s * 0.2},${cx} ${cy - s} C${cx + 8} ${cy - s * 0.2},${cx + s * 0.7} ${cy},${cx} ${cy + s}" fill="${a}"/>
        <path d="M${cx} ${cy + s * 0.55} C${cx - s * 0.35} ${cy},${cx} ${cy - s * 0.35},${cx} ${cy - s * 0.15} C${cx + s * 0.28} ${cy},${cx + 10} ${cy + 20},${cx} ${cy + s * 0.55}" fill="${b}"/>`;
    case "snowflake":
      return `<g stroke="${a}" stroke-width="4" stroke-linecap="round" fill="none">
        ${[0, 60, 120].map((deg) => `<line x1="${cx}" y1="${cy - s}" x2="${cx}" y2="${cy + s}" transform="rotate(${deg} ${cx} ${cy})"/>`).join("")}
        </g>
        <circle cx="${cx}" cy="${cy}" r="7" fill="#fff"/>`;
    case "ghost":
      return `<path d="M${cx - s * 0.55} ${cy} Q${cx - s * 0.55} ${cy - s},${cx} ${cy - s} Q${cx + s * 0.55} ${cy - s},${cx + s * 0.55} ${cy} L${cx + s * 0.55} ${cy + s} L${cx + s * 0.25} ${cy + s * 0.7} L${cx} ${cy + s} L${cx - s * 0.28} ${cy + s * 0.7} L${cx - s * 0.55} ${cy + s} Z" fill="${a}" opacity=".55" stroke="#fff" stroke-width="2"/>
        <circle cx="${cx - 12}" cy="${cy - 8}" r="6" fill="#111"/><circle cx="${cx + 14}" cy="${cy - 8}" r="6" fill="#111"/>`;
    case "moon":
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.72}" fill="${a}"/>
        <circle cx="${cx + s * 0.28}" cy="${cy - s * 0.12}" r="${s * 0.58}" fill="#1a0510"/>
        <circle cx="${cx - s * 0.2}" cy="${cy + 10}" r="8" fill="${b}" opacity=".5"/>`;
    case "eclipse":
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.7}" fill="${b}"/>
        <circle cx="${cx + s * 0.18}" cy="${cy}" r="${s * 0.58}" fill="#050508"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.85}" fill="none" stroke="${a}" stroke-width="3"/>`;
    case "spectrum":
      return ["#22d3ee", "#818cf8", "#e879f9", "#fb7185", "#fbbf24"]
        .map((c, i) => `<rect x="${cx - s + i * s * 0.4}" y="${cy - s * 0.7}" width="${s * 0.32}" height="${s * 1.4}" rx="4" fill="${c}"/>`)
        .join("");
    case "galaxy":
      return `<ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.32}" fill="none" stroke="${a}" stroke-width="3" transform="rotate(-24 ${cx} ${cy})"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${s * 0.7}" ry="${s * 0.22}" fill="none" stroke="${b}" stroke-width="2" transform="rotate(18 ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.2}" fill="#fff"/>`;
    case "shadow":
      return `<ellipse cx="${cx}" cy="${cy + s * 0.15}" rx="${s * 0.75}" ry="${s * 0.5}" fill="#000" opacity=".85"/>
        <path d="M${cx - s * 0.4} ${cy} Q${cx} ${cy - s},${cx + s * 0.4} ${cy}" fill="none" stroke="${a}" stroke-width="3"/>`;
    case "crown":
      return `<path d="M${cx - s} ${cy + s * 0.45} L${cx - s * 0.75} ${cy - s * 0.55} L${cx - s * 0.25} ${cy} L${cx} ${cy - s} L${cx + s * 0.25} ${cy} L${cx + s * 0.75} ${cy - s * 0.55} L${cx + s} ${cy + s * 0.45} Z" fill="${a}" stroke="#fff" stroke-width="2"/>
        <rect x="${cx - s * 0.85}" y="${cy + s * 0.45}" width="${s * 1.7}" height="${s * 0.22}" rx="3" fill="${b}"/>`;
    case "gem":
      return `<polygon points="${cx},${cy - s} ${cx + s * 0.7},${cy - s * 0.15} ${cx + s * 0.45},${cy + s} ${cx - s * 0.45},${cy + s} ${cx - s * 0.7},${cy - s * 0.15}" fill="${a}" stroke="#fff" stroke-width="2"/>
        <polygon points="${cx},${cy - s * 0.45} ${cx + s * 0.28},${cy} ${cx},${cy + s * 0.35} ${cx - s * 0.28},${cy}" fill="#fff" opacity=".35"/>`;
    case "ruby":
      return `<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.62}" ry="${s * 0.82}" fill="${a}" stroke="#fff" stroke-width="2"/>
        <polygon points="${cx},${cy - s * 0.55} ${cx + s * 0.32},${cy} ${cx},${cy + s * 0.5} ${cx - s * 0.32},${cy}" fill="#fff" opacity=".28"/>`;
    case "sapphire":
      return `<polygon points="${cx},${cy - s} ${cx + s * 0.86},${cy - s * 0.5} ${cx + s * 0.86},${cy + s * 0.5} ${cx},${cy + s} ${cx - s * 0.86},${cy + s * 0.5} ${cx - s * 0.86},${cy - s * 0.5}" fill="${a}" stroke="#fff" stroke-width="2"/>
        <polygon points="${cx},${cy - s * 0.4} ${cx + s * 0.32},${cy} ${cx},${cy + s * 0.4} ${cx - s * 0.32},${cy}" fill="#fff" opacity=".3"/>`;
    case "ingot":
      return `<g>
        <rect x="${cx - s * 0.85}" y="${cy - 8}" width="${s * 1.7}" height="${s * 0.42}" rx="4" fill="${a}"/>
        <rect x="${cx - s * 0.7}" y="${cy - s * 0.55}" width="${s * 1.4}" height="${s * 0.42}" rx="4" fill="${b}"/>
        <rect x="${cx - s * 0.55}" y="${cy - s}" width="${s * 1.1}" height="${s * 0.42}" rx="4" fill="${a}"/>
      </g>`;
    case "crescent":
      return `<path d="M${cx + s * 0.15} ${cy - s} A${s} ${s} 0 1 0 ${cx + s * 0.15} ${cy + s} A${s * 0.72} ${s * 0.72} 0 1 1 ${cx + s * 0.15} ${cy - s}" fill="${a}"/>`;
    case "engine":
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.72}" fill="none" stroke="${a}" stroke-width="10"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.28}" fill="${b}"/>
        ${[0, 45, 90, 135].map((d) => `<rect x="${cx - 6}" y="${cy - s}" width="12" height="${s * 0.35}" rx="2" fill="${a}" transform="rotate(${d} ${cx} ${cy})"/>`).join("")}`;
    case "prompt":
      return `<text x="${cx - s * 0.7}" y="${cy}" fill="${a}" font-family="ui-monospace,monospace" font-size="${s * 0.7}" font-weight="700">&gt;_</text>
        <rect x="${cx + 8}" y="${cy - s * 0.35}" width="${s * 0.22}" height="${s * 0.7}" fill="${b}"/>`;
    case "atom":
      return `<ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.32}" fill="none" stroke="${a}" stroke-width="3"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.32}" fill="none" stroke="${b}" stroke-width="3" transform="rotate(60 ${cx} ${cy})"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.32}" fill="none" stroke="#fff" stroke-width="2" transform="rotate(120 ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="8" fill="#fff"/>`;
    case "vortex":
      return `<path d="M${cx} ${cy} m${-s},0 a${s},${s * 0.45} 0 1,0 ${s * 2},0" fill="none" stroke="${a}" stroke-width="5"/>
        <path d="M${cx} ${cy} m${-s * 0.65},0 a${s * 0.65},${s * 0.28} 0 1,1 ${s * 1.3},0" fill="none" stroke="${b}" stroke-width="4"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.16}" fill="#fff"/>`;
    case "shard":
      return `<polygon points="${cx},${cy - s} ${cx + s * 0.35},${cy - s * 0.2} ${cx + s * 0.7},${cy + s * 0.15} ${cx + 6},${cy + s} ${cx - s * 0.4},${cy + s * 0.4} ${cx - s * 0.75},${cy - 8}" fill="${a}" stroke="${b}" stroke-width="2"/>
        <polygon points="${cx - 6},${cy - s * 0.4} ${cx + 18},${cy} ${cx - 10},${cy + 22}" fill="#fff" opacity=".25"/>`;
    case "seed":
      return `<circle cx="${cx}" cy="${cy + s * 0.15}" r="${s * 0.32}" fill="${a}"/>
        <path d="M${cx} ${cy + s * 0.15} Q${cx - s * 0.7} ${cy - s * 0.4} ${cx} ${cy - s} Q${cx + s * 0.7} ${cy - s * 0.4} ${cx} ${cy + s * 0.15}" fill="${b}" opacity=".85"/>`;
    case "titan":
      return `<rect x="${cx - s * 0.55}" y="${cy - s * 0.85}" width="${s * 1.1}" height="${s * 1.7}" rx="10" fill="${a}" opacity=".85"/>
        <rect x="${cx - s * 0.28}" y="${cy - s * 0.35}" width="${s * 0.56}" height="${s * 0.7}" fill="#111" opacity=".5"/>
        <circle cx="${cx}" cy="${cy - s * 0.55}" r="8" fill="${b}"/>`;
    case "burst":
      return Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2;
        const x2 = cx + Math.cos(ang) * s;
        const y2 = cy + Math.sin(ang) * s;
        return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${i % 2 ? a : b}" stroke-width="4"/>`;
      }).join("") + `<circle cx="${cx}" cy="${cy}" r="${s * 0.22}" fill="#fff"/>`;
    case "speed":
      return Array.from({ length: 6 }, (_, i) => `<rect x="${cx - s + i * 8}" y="${cy - s + i * 12}" width="${s * 1.6 - i * 10}" height="7" rx="3" fill="${i % 2 ? a : b}" opacity="${0.95 - i * 0.1}"/>`).join("");
    case "scope":
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.8}" fill="none" stroke="${a}" stroke-width="8"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.45}" fill="none" stroke="${b}" stroke-width="3"/>
        <path d="M${cx} ${cy - s} V${cy + s} M${cx - s} ${cy} H${cx + s}" stroke="#fff" stroke-width="2"/>`;
    case "chrome":
      return `<rect x="${cx - s * 0.75}" y="${cy - s * 0.55}" width="${s * 1.5}" height="${s * 1.1}" rx="8" fill="${a}" stroke="#fff" stroke-width="2"/>
        <path d="M${cx - s * 0.55} ${cy - 10} Q${cx} ${cy - s * 0.4} ${cx + s * 0.55} ${cy + 8}" fill="none" stroke="#fff" stroke-width="8" opacity=".7"/>`;
    case "lava":
      return `<path d="M${cx - s} ${cy + s * 0.4} Q${cx - 20} ${cy - s},${cx} ${cy - s * 0.35} Q${cx + 30} ${cy + 10},${cx + s} ${cy + s * 0.2} L${cx + s} ${cy + s} L${cx - s} ${cy + s} Z" fill="${a}"/>
        <circle cx="${cx - 10}" cy="${cy + 20}" r="10" fill="${b}"/>
        <circle cx="${cx + 22}" cy="${cy + 8}" r="7" fill="#fbbf24"/>`;
    case "lotus":
      return [ -40, -20, 0, 20, 40 ]
        .map((rot) => `<ellipse cx="${cx}" cy="${cy - s * 0.15}" rx="${s * 0.22}" ry="${s * 0.75}" fill="${a}" opacity=".8" transform="rotate(${rot} ${cx} ${cy + 10})"/>`)
        .join("") + `<circle cx="${cx}" cy="${cy + 12}" r="10" fill="${b}"/>`;
    case "dunes":
      return `<path d="M${cx - s} ${cy + s * 0.4} Q${cx - s * 0.2} ${cy - s * 0.6} ${cx + s * 0.2} ${cy + 8} Q${cx + s * 0.55} ${cy - s * 0.3} ${cx + s} ${cy + s * 0.35} L${cx + s} ${cy + s} L${cx - s} ${cy + s} Z" fill="${a}"/>
        <path d="M${cx - s * 0.4} ${cy + s} Q${cx + 10} ${cy} ${cx + s * 0.7} ${cy + s}" fill="${b}" opacity=".5"/>`;
    case "pulse":
      return `<polyline points="${cx - s},${cy} ${cx - s * 0.45},${cy} ${cx - s * 0.22},${cy - s * 0.7} ${cx},${cy + s * 0.75} ${cx + s * 0.22},${cy - s * 0.35} ${cx + s * 0.45},${cy} ${cx + s},${cy}" fill="none" stroke="${a}" stroke-width="6" stroke-linejoin="round"/>`;
    case "hexseal":
      return `<polygon points="${cx},${cy - s} ${cx + s * 0.86},${cy - s * 0.5} ${cx + s * 0.86},${cy + s * 0.5} ${cx},${cy + s} ${cx - s * 0.86},${cy + s * 0.5} ${cx - s * 0.86},${cy - s * 0.5}" fill="none" stroke="${a}" stroke-width="5"/>
        <polygon points="${cx},${cy - s * 0.5} ${cx + s * 0.43},${cy - s * 0.25} ${cx + s * 0.43},${cy + s * 0.25} ${cx},${cy + s * 0.5} ${cx - s * 0.43},${cy + s * 0.25} ${cx - s * 0.43},${cy - s * 0.25}" fill="${b}" opacity=".8"/>`;
    case "meteor":
      return `<circle cx="${cx + s * 0.15}" cy="${cy + s * 0.15}" r="${s * 0.5}" fill="${a}"/>
        <path d="M${cx + s * 0.15} ${cy + s * 0.15} L${cx - s} ${cy - s}" stroke="${b}" stroke-width="10" stroke-linecap="round"/>
        <path d="M${cx} ${cy} L${cx - s * 0.7} ${cy - s * 0.55}" stroke="#fff" stroke-width="4"/>`;
    case "thunder":
      return `<path d="M${cx - s * 0.7} ${cy - s} L${cx + s * 0.15} ${cy - s} L${cx - 8} ${cy} H${cx + s * 0.45} L${cx - s * 0.35} ${cy + s} L${cx} ${cy + 8} H${cx - s * 0.55} Z" fill="${a}" stroke="${b}"/>`;
    case "aurora":
      return `<path d="M${cx - s} ${cy + s * 0.3} Q${cx - 20} ${cy - s},${cx + 10} ${cy - s * 0.2} Q${cx + s * 0.5} ${cy + s * 0.3},${cx + s} ${cy - 10}" fill="none" stroke="${a}" stroke-width="10" opacity=".85"/>
        <path d="M${cx - s} ${cy + s * 0.55} Q${cx} ${cy - s * 0.4},${cx + s} ${cy + 18}" fill="none" stroke="${b}" stroke-width="7" opacity=".7"/>`;
    case "ivory":
      return `<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.38}" ry="${s}" fill="${a}" stroke="#fff" stroke-width="2"/>
        <path d="M${cx - s * 0.2} ${cy - s * 0.55} Q${cx + s * 0.55} ${cy},${cx - s * 0.15} ${cy + s * 0.7}" fill="none" stroke="${b}" stroke-width="3"/>`;
    case "singularity":
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.22}" fill="#050508"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.5}" fill="none" stroke="${a}" stroke-width="6"/>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.82}" fill="none" stroke="${b}" stroke-width="2" stroke-dasharray="8 10"/>`;
    case "arrow":
      return `<path d="M${cx - s} ${cy} H${cx + s * 0.15} L${cx - 8} ${cy - s * 0.35} M${cx + s * 0.15} ${cy} L${cx - 8} ${cy + s * 0.35} M${cx + s * 0.15} ${cy} L${cx + s} ${cy}" fill="none" stroke="${a}" stroke-width="7" stroke-linejoin="round"/>`;
    case "stencil":
      return `<text x="${cx}" y="${cy + s * 0.22}" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="${s * 0.85}" fill="${a}" opacity=".95">CM</text>
        <rect x="${cx - s * 0.85}" y="${cy - s}" width="${s * 1.7}" height="${s * 0.14}" fill="${b}"/>
        <rect x="${cx - s * 0.85}" y="${cy + s * 0.85}" width="${s * 1.7}" height="${s * 0.14}" fill="${b}"/>`;
    case "skyline":
      return [0.4, 0.7, 0.5, 0.9, 0.35, 0.65, 0.45]
        .map((h, i) => `<rect x="${cx - s + i * s * 0.28}" y="${cy + s - h * s * 2}" width="${s * 0.22}" height="${h * s * 2}" fill="${i % 2 ? a : b}"/>`)
        .join("");
    case "fracture":
      return `<polygon points="${cx - s},${cy - s * 0.3} ${cx - 10},${cy - s} ${cx + s * 0.2},${cy - s * 0.45} ${cx + s},${cy + 4} ${cx + 20},${cy + s} ${cx - s * 0.4},${cy + s * 0.55}" fill="${a}" opacity=".85"/>
        <polyline points="${cx - s * 0.4},${cy - s * 0.5} ${cx + 4},${cy} ${cx - 8},${cy + s * 0.7}" fill="none" stroke="#fff" stroke-width="3"/>`;
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.6}" fill="${a}"/>`;
  }
}

function wrapFill(spec, x, y, w, h) {
  const a = spec.a;
  const b = spec.b;
  const seed = hash(spec.id);
  const kind = spec.body;
  if (kind === "hex") {
    const cells = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        const cx = x + 28 + c * 54 + (r % 2) * 27;
        const cy = y + 28 + r * 42;
        cells.push(
          `<polygon points="${cx},${cy - 16} ${cx + 14},${cy - 8} ${cx + 14},${cy + 8} ${cx},${cy + 16} ${cx - 14},${cy + 8} ${cx - 14},${cy - 8}" fill="none" stroke="${c % 2 ? a : b}" stroke-opacity=".55" stroke-width="1.6"/>`,
        );
      }
    }
    return cells.join("");
  }
  if (kind === "ice" || kind === "crystal") {
    return `<polygon points="${x},${y} ${x + w * 0.45},${y} ${x + w * 0.2},${y + h}" fill="#fff" opacity=".14"/>
      <polyline points="${x + 40},${y} ${x + 90},${y + h * 0.45} ${x + 30},${y + h}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>
      <polyline points="${x + w - 50},${y} ${x + w - 110},${y + h * 0.55} ${x + w - 20},${y + h}" fill="none" stroke="${a}" stroke-opacity=".5" stroke-width="2"/>`;
  }
  if (kind === "canister" || kind === "ammo") {
    return Array.from({ length: 7 }, (_, i) => {
      const xx = x - 40 + i * 58;
      return `<rect x="${xx}" y="${y}" width="22" height="${h}" transform="skewX(-18)" fill="${i % 2 ? a : b}" opacity=".28"/>`;
    }).join("");
  }
  if (kind === "armored" || kind === "sniper") {
    const ribs = Array.from({ length: 6 }, (_, i) => `<rect x="${x + 18 + i * 52}" y="${y + 12}" width="10" height="${h - 24}" rx="2" fill="#000" opacity=".35"/>`).join("");
    const rivets = Array.from({ length: 8 }, (_, i) => `<circle cx="${x + 28 + (i % 4) * 80}" cy="${y + 22 + Math.floor(i / 4) * (h - 44)}" r="4" fill="${b}" stroke="#fff" stroke-opacity=".35"/>`).join("");
    return ribs + rivets;
  }
  if (kind === "relic" || kind === "urn" || kind === "diamond") {
    return `<rect x="${x + 16}" y="${y + 14}" width="${w - 32}" height="${h - 28}" fill="none" stroke="${b}" stroke-width="3" opacity=".7"/>
      <rect x="${x + 28}" y="${y + 26}" width="${w - 56}" height="${h - 52}" fill="none" stroke="${a}" stroke-width="1.5" opacity=".55"/>
      <polygon points="${x + w / 2},${y + 36} ${x + w - 48},${y + h / 2} ${x + w / 2},${y + h - 36} ${x + 48},${y + h / 2}" fill="${a}" opacity=".18" stroke="${b}" stroke-opacity=".5"/>`;
  }
  if (kind === "coffin" || kind === "pyramid") {
    return `<polygon points="${x + 24},${y + h - 16} ${x + w / 2},${y + 18} ${x + w - 24},${y + h - 16}" fill="${a}" opacity=".2" stroke="${b}" stroke-width="2"/>`;
  }
  if (kind === "terminal" || kind === "capsule") {
    return `<rect x="${x + 22}" y="${y + 22}" width="${w - 44}" height="${h - 44}" rx="8" fill="#041016" opacity=".7" stroke="${a}" stroke-opacity=".45"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${x + 36}" y="${y + 40 + i * 26}" width="${80 + ((seed >> i) % 90)}" height="8" rx="2" fill="${i % 2 ? a : b}" opacity=".45"/>`).join("")}`;
  }
  if (kind === "glass") {
    return `<path d="M${x + 18},${y + 22} L${x + w * 0.62},${y + 22} L${x + w * 0.48},${y + 70} L${x + 34},${y + 70} Z" fill="#fff" opacity=".16"/>
      <rect x="${x + 20}" y="${y + 20}" width="${w - 40}" height="${h - 40}" fill="none" stroke="${a}" stroke-opacity=".4"/>`;
  }
  if (kind === "cracked") {
    return `<polyline points="${x + 30},${y} ${x + w * 0.4},${y + h * 0.5} ${x + 20},${y + h}" fill="none" stroke="#fff" stroke-width="3" opacity=".65"/>
      <polyline points="${x + w - 40},${y} ${x + w * 0.55},${y + h * 0.58} ${x + w - 18},${y + h}" fill="none" stroke="${b}" stroke-width="3"/>`;
  }
  if (kind === "spiral" || kind === "orbCage") {
    return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * 0.38}" ry="${h * 0.28}" fill="none" stroke="${a}" stroke-width="4"/>
      <ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * 0.26}" ry="${h * 0.18}" fill="none" stroke="${b}" stroke-width="3" transform="rotate(28 ${x + w / 2} ${y + h / 2})"/>`;
  }
  if (kind === "hex") return "";
  const stripeCount = 5 + (seed % 4);
  return Array.from({ length: stripeCount }, (_, i) => {
    const xx = x - 30 + i * ((w + 40) / stripeCount);
    return `<rect x="${xx}" y="${y}" width="${10 + (i % 3) * 6}" height="${h}" transform="skewX(-22)" fill="${i % 2 ? a : b}" opacity=".22"/>`;
  }).join("");
}

/** Closed CS-style weapon crate: isometric lid, latches, unique wrap on the front. */
function crateBody(spec) {
  const a = spec.a;
  const b = spec.b;
  const seed = hash(spec.id);
  const gid = uid(spec, "body");
  const clip = uid(spec, "clip");
  const wide = spec.body === "sniper" ? 28 : spec.body === "ammo" ? 12 : (seed % 17) - 8;
  const tall = spec.body === "capsule" || spec.body === "canister" ? 22 : spec.body === "sniper" ? -24 : (seed % 13) - 6;
  const fx = 232 - wide;
  const fy = 318 - tall;
  const fw = 336 + wide * 2;
  const fh = 196 + tall;
  const iso = 68 + (seed % 10);
  const rise = 58 + (seed % 8);
  const lx = fx;
  const ly = fy - 42;
  const rx = fx + fw;
  const ry = fy - 42;
  const metal = mixHex("#9aa3b2", a, 0.16);
  const lidCol = mixHex("#222632", a, 0.42);
  const sideCol = mixHex("#0d0f16", b, 0.35);
  const frontCol = mixHex("#141824", a, 0.5);
  const rim = mixHex("#ffffff", a, 0.28);
  const latchCol = spec.premium || spec.body === "relic" || spec.body === "diamond" ? mixHex("#fbbf24", b, 0.35) : metal;
  const stickerS = spec.premium ? 30 : 24;
  const sticker = motifSvg(spec, fx + fw / 2, fy + fh * 0.52, stickerS);

  return `
    <linearGradient id="${gid}lid" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${lidCol}"/><stop offset="1" stop-color="${mixHex(lidCol, "#ffffff", 0.22)}"/>
    </linearGradient>
    <linearGradient id="${gid}side" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${mixHex(sideCol, a, 0.2)}"/><stop offset="1" stop-color="${sideCol}"/>
    </linearGradient>
    <linearGradient id="${gid}front" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mixHex(frontCol, a, 0.18)}"/><stop offset="1" stop-color="${mixHex(frontCol, "#000", 0.35)}"/>
    </linearGradient>
    <clipPath id="${clip}"><rect x="${fx + 10}" y="${fy + 12}" width="${fw - 20}" height="${fh - 28}" rx="6"/></clipPath>
    <ellipse cx="400" cy="${fy + fh + 48}" rx="${fw * 0.48}" ry="22" fill="#000" opacity=".55"/>
    <polygon points="${rx},${ly} ${rx + iso},${ly - rise} ${rx + iso},${ly - rise + fh + 42} ${rx},${fy + fh}" fill="url(#${gid}side)" stroke="${rim}" stroke-width="1.2"/>
    <polygon points="${lx},${ly} ${lx + iso},${ly - rise} ${rx + iso},${ly - rise} ${rx},${ly}" fill="url(#${gid}lid)" stroke="${rim}" stroke-width="1.6"/>
    <rect x="${fx}" y="${ly}" width="${fw}" height="42" fill="url(#${gid}lid)" stroke="${rim}" stroke-width="1.2"/>
    <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="url(#${gid}front)" stroke="${rim}" stroke-width="1.5"/>
    <g clip-path="url(#${clip})">
      <rect x="${fx + 10}" y="${fy + 12}" width="${fw - 20}" height="${fh - 28}" fill="${mixHex(a, "#0a0c12", 0.62)}"/>
      ${wrapFill(spec, fx + 10, fy + 12, fw - 20, fh - 28)}
    </g>
    <rect x="${fx + 10}" y="${fy + 12}" width="${fw - 20}" height="${fh - 28}" rx="6" fill="none" stroke="${a}" stroke-opacity=".35"/>
    <g opacity=".92">${sticker}</g>
    <rect x="${fx + 36}" y="${ly + 14}" width="54" height="16" rx="3" fill="${latchCol}" stroke="#fff" stroke-opacity=".3"/>
    <rect x="${rx - 90}" y="${ly + 14}" width="54" height="16" rx="3" fill="${latchCol}" stroke="#fff" stroke-opacity=".3"/>
    <rect x="${fx + 8}" y="${fy + fh - 10}" width="${fw - 16}" height="8" fill="${mixHex("#000", b, 0.25)}"/>
    ${spec.premium ? `<polygon points="${fx},${ly} ${fx + 22},${ly} ${fx + 22},${ly + 18}" fill="${latchCol}" opacity=".8"/>
      <polygon points="${rx},${ly} ${rx - 22},${ly} ${rx - 22},${ly + 18}" fill="${latchCol}" opacity=".8"/>` : ""}
    <text x="${fx + 22}" y="${fy + fh - 18}" font-family="Arial Black,Impact,sans-serif" font-size="11" letter-spacing="1.6" fill="${a}" fill-opacity=".45">${spec.name.toUpperCase().slice(0, 14)}</text>
  `;
}

function particles(spec, n, spread = 1) {
  const seed = hash(spec.id + "p");
  return Array.from({ length: n }, (_, i) => {
    const x = 120 + ((seed * (i + 3)) % 560);
    const y = 90 + ((seed * (i + 11) * 13) % 520);
    const r = 1.4 + (i % 5) * 0.7 * spread;
    const col = i % 2 ? spec.a : spec.b;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${0.25 + (i % 5) * 0.1}"/>`;
  }).join("");
}

function premiumFrame(spec) {
  if (!spec.premium) return "";
  return `
    <rect x="48" y="48" width="704" height="704" rx="36" fill="none" stroke="${spec.b}" stroke-opacity=".45" stroke-width="2"/>
    <rect x="62" y="62" width="676" height="676" rx="30" fill="none" stroke="${spec.a}" stroke-opacity=".25" stroke-width="1"/>
    <circle cx="80" cy="80" r="6" fill="${spec.a}"/>
    <circle cx="720" cy="80" r="6" fill="${spec.b}"/>
    <circle cx="80" cy="720" r="6" fill="${spec.b}"/>
    <circle cx="720" cy="720" r="6" fill="${spec.a}"/>`;
}

function caseSvg(spec, role) {
  const crop = role === "thumb";
  const view = crop ? "110 140 580 540" : "0 0 800 800";
  const gid = uid(spec, role);
  const glowR = spec.premium ? 210 : 160;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${crop ? 480 : 800}" height="${crop ? 480 : 800}" role="img" aria-label="${spec.name} crate">
  <!-- prismloot:${spec.id}:${role} -->
  <defs>
    <radialGradient id="${gid}glow" cx="50%" cy="38%" r="50%">
      <stop offset="0" stop-color="${rgba(spec.a, spec.premium ? 0.48 : 0.32)}"/>
      <stop offset="1" stop-color="rgba(5,5,8,0)"/>
    </radialGradient>
    <linearGradient id="${uid(spec, "m")}g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${spec.a}"/><stop offset="1" stop-color="${spec.b}"/>
    </linearGradient>
    <filter id="${gid}blur"><feGaussianBlur stdDeviation="14"/></filter>
    <radialGradient id="${gid}floor" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${rgba(spec.a, 0.22)}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="#07070c"/>
  <rect width="800" height="800" fill="url(#${gid}glow)"/>
  <ellipse cx="400" cy="600" rx="230" ry="36" fill="url(#${gid}floor)"/>
  <circle cx="400" cy="330" r="${glowR}" fill="${spec.a}" opacity="${spec.premium ? 0.2 : 0.12}" filter="url(#${gid}blur)"/>
  ${particles(spec, spec.premium ? 16 : 7, 0.75)}
  ${spec.premium ? premiumFrame(spec) : ""}
  <g>${crateBody(spec)}</g>
</svg>`;
}

function bgShapes(spec) {
  const s = hash(spec.id);
  switch (spec.scene) {
    case "studio-prism":
      return `<polygon points="80,80 240,40 200,260" fill="${spec.a}" opacity=".12"/>
        <polygon points="1500,80 1580,340 1200,160" fill="${spec.b}" opacity=".12"/>`;
    case "neon-grid":
      return Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${80 + i * 70}" x2="1600" y2="${40 + i * 70}" stroke="${spec.a}" stroke-opacity=".12"/>`).join("");
    case "storm":
      return `<polyline points="200,0 260,180 140,180 320,420" fill="none" stroke="${spec.a}" stroke-width="8" opacity=".35"/>
        <polyline points="1100,40 1020,220 1180,210 980,480" fill="none" stroke="${spec.b}" stroke-width="6" opacity=".3"/>`;
    case "protocol":
      return `<circle cx="200" cy="160" r="120" fill="none" stroke="${spec.a}" stroke-opacity=".2" stroke-width="3"/>
        <circle cx="1400" cy="700" r="180" fill="none" stroke="${spec.b}" stroke-opacity=".2" stroke-width="3"/>`;
    case "nebula":
      return `<circle cx="420" cy="220" r="200" fill="${spec.a}" opacity=".15"/>
        <circle cx="1180" cy="500" r="260" fill="${spec.b}" opacity=".12"/>`;
    case "lair":
      return `<path d="M0,900 Q400,420 800,700 T1600,500 V900 Z" fill="${spec.a}" opacity=".12"/>
        <path d="M80,80 Q240,40 320,180" fill="none" stroke="${spec.b}" stroke-width="10" opacity=".25"/>`;
    case "glacier":
      return `<polygon points="0,900 200,420 420,900" fill="${spec.a}" opacity=".14"/>
        <polygon points="900,900 1200,280 1500,900" fill="${spec.b}" opacity=".12"/>`;
    case "nightops":
      return `<rect x="80" y="120" width="220" height="12" fill="${spec.a}" opacity=".2"/>
        <rect x="80" y="150" width="140" height="8" fill="${spec.b}" opacity=".2"/>
        <circle cx="1320" cy="180" r="70" fill="none" stroke="${spec.a}" stroke-opacity=".25"/>`;
    case "alley":
      return `<rect x="80" y="200" width="90" height="700" fill="${spec.a}" opacity=".1"/>
        <rect x="220" y="320" width="70" height="580" fill="${spec.b}" opacity=".1"/>
        <rect x="1300" y="180" width="120" height="720" fill="${spec.a}" opacity=".1"/>`;
    case "phantom":
      return `<ellipse cx="800" cy="420" rx="420" ry="160" fill="${spec.a}" opacity=".08"/>
        <path d="M500,500 Q800,200 1100,520" fill="none" stroke="${spec.b}" stroke-opacity=".2" stroke-width="8"/>`;
    case "syndicate":
      return `<polygon points="800,80 860,200 740,200" fill="${spec.a}" opacity=".2"/>
        <rect x="200" y="600" width="1200" height="2" fill="${spec.b}" opacity=".25"/>`;
    case "carbon":
      return Array.from({ length: 18 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90 + 80}" y2="900" stroke="${spec.a}" stroke-opacity=".08" stroke-width="6"/>`).join("");
    case "rush":
      return Array.from({ length: 10 }, (_, i) => `<rect x="${60 + i * 155}" y="${200 + (s % 40)}" width="16" height="${400 + (i % 5) * 40}" fill="${i % 2 ? spec.a : spec.b}" opacity=".1"/>`).join("");
    case "cyber":
      return `<path d="M80,120 H420 V260 H200 V400" fill="none" stroke="${spec.a}" stroke-opacity=".22" stroke-width="3"/>
        <path d="M1520,80 H1100 V300 H1400" fill="none" stroke="${spec.b}" stroke-opacity=".22" stroke-width="3"/>`;
    case "haze":
      return `<ellipse cx="500" cy="400" rx="300" ry="140" fill="${spec.a}" opacity=".14"/>
        <ellipse cx="1100" cy="500" rx="340" ry="160" fill="${spec.b}" opacity=".12"/>`;
    case "inferno":
      return `<path d="M0,900 L200,420 L360,900 Z" fill="${spec.a}" opacity=".18"/>
        <path d="M600,900 L820,280 L1040,900 Z" fill="${spec.b}" opacity=".14"/>
        <path d="M1240,900 L1480,340 L1600,900 Z" fill="${spec.a}" opacity=".12"/>`;
    case "arctic":
      return `<polygon points="0,0 260,0 80,180" fill="#fff" opacity=".06"/>
        <polygon points="1400,40 1600,0 1600,220" fill="${spec.a}" opacity=".12"/>`;
    case "ghost":
      return `<circle cx="300" cy="240" r="90" fill="${spec.a}" opacity=".08"/>
        <circle cx="1280" cy="620" r="140" fill="${spec.b}" opacity=".08"/>`;
    case "bloodmoon":
      return `<circle cx="1280" cy="180" r="140" fill="${spec.a}" opacity=".35"/>
        <circle cx="1330" cy="160" r="110" fill="#0a0408" opacity=".8"/>`;
    case "eclipse":
      return `<circle cx="800" cy="220" r="160" fill="${spec.b}" opacity=".2"/>
        <circle cx="830" cy="220" r="130" fill="#050508"/>`;
    case "spectrum":
      return ["#22d3ee", "#818cf8", "#e879f9", "#fb7185", "#fbbf24"].map((c, i) => `<rect x="${i * 320}" y="0" width="320" height="900" fill="${c}" opacity=".07"/>`).join("");
    case "galaxy":
      return Array.from({ length: 40 }, (_, i) => {
        const x = (s * (i + 2)) % 1600;
        const y = (s * (i + 7) * 9) % 900;
        return `<circle cx="${x}" cy="${y}" r="${1 + (i % 3)}" fill="#fff" opacity="${0.2 + (i % 5) * 0.1}"/>`;
      }).join("");
    case "shadow":
      return `<rect x="0" y="0" width="1600" height="900" fill="#000" opacity=".25"/>
        <ellipse cx="800" cy="600" rx="400" ry="80" fill="${spec.a}" opacity=".08"/>`;
    case "palace":
      return `<rect x="200" y="300" width="80" height="600" fill="${spec.a}" opacity=".1"/>
        <rect x="320" y="220" width="80" height="680" fill="${spec.b}" opacity=".1"/>
        <rect x="1200" y="260" width="90" height="640" fill="${spec.a}" opacity=".1"/>
        <polygon points="800,80 860,180 740,180" fill="${spec.b}" opacity=".25"/>`;
    case "emerald":
      return `<polygon points="200,80 320,40 280,220" fill="${spec.a}" opacity=".2"/>
        <polygon points="1300,600 1500,480 1540,780" fill="${spec.b}" opacity=".18"/>`;
    case "ruby":
      return `<polygon points="180,200 360,80 300,360" fill="${spec.a}" opacity=".2"/>
        <polygon points="1200,100 1480,80 1360,340" fill="${spec.b}" opacity=".16"/>`;
    case "sapphire":
      return `<circle cx="240" cy="200" r="160" fill="${spec.a}" opacity=".16"/>
        <circle cx="1360" cy="680" r="180" fill="${spec.b}" opacity=".14"/>`;
    case "vault":
      return `<circle cx="800" cy="450" r="220" fill="none" stroke="${spec.a}" stroke-width="18" opacity=".15"/>
        <circle cx="800" cy="450" r="120" fill="none" stroke="${spec.b}" stroke-width="8" opacity=".2"/>`;
    case "nightfall":
      return `<path d="M0,180 Q800,40 1600,220 V0 H0 Z" fill="${spec.a}" opacity=".18"/>
        <circle cx="1240" cy="140" r="36" fill="${spec.b}" opacity=".35"/>`;
    case "overdrive":
      return Array.from({ length: 8 }, (_, i) => `<rect x="${100 + i * 180}" y="320" width="90" height="14" fill="${spec.a}" opacity=".16"/>`).join("");
    case "terminal":
      return Array.from({ length: 16 }, (_, i) => `<text x="80" y="${60 + i * 40}" fill="${spec.a}" opacity=".12" font-family="monospace" font-size="18">${(s + i).toString(16)} 0x${(s * (i + 3)).toString(16).slice(0, 6)}</text>`).join("");
    case "quantum":
      return `<ellipse cx="800" cy="450" rx="380" ry="80" fill="none" stroke="${spec.a}" opacity=".2" stroke-width="3"/>
        <ellipse cx="800" cy="450" rx="380" ry="80" fill="none" stroke="${spec.b}" opacity=".2" stroke-width="3" transform="rotate(60 800 450)"/>`;
    case "vortex":
      return `<path d="M800,450 m-300,0 a300,120 0 1,0 600,0" fill="none" stroke="${spec.a}" opacity=".2" stroke-width="8"/>
        <path d="M800,450 m-180,0 a180,70 0 1,1 360,0" fill="none" stroke="${spec.b}" opacity=".2" stroke-width="6"/>`;
    case "obsidian":
      return `<polygon points="100,80 280,40 180,300" fill="${spec.a}" opacity=".2"/>
        <polygon points="1400,200 1580,80 1500,420" fill="${spec.b}" opacity=".16"/>`;
    case "genesis":
      return `<circle cx="800" cy="720" r="40" fill="${spec.a}" opacity=".25"/>
        <path d="M800,720 C640,500 960,420 800,220" fill="none" stroke="${spec.b}" stroke-width="6" opacity=".25"/>`;
    case "titan":
      return `<rect x="120" y="200" width="140" height="700" fill="${spec.a}" opacity=".08"/>
        <rect x="1340" y="160" width="160" height="740" fill="${spec.b}" opacity=".08"/>`;
    case "nova":
      return Array.from({ length: 16 }, (_, i) => {
        const ang = (i / 16) * Math.PI * 2;
        return `<line x1="800" y1="200" x2="${800 + Math.cos(ang) * 500}" y2="${200 + Math.sin(ang) * 180}" stroke="${i % 2 ? spec.a : spec.b}" opacity=".16" stroke-width="3"/>`;
      }).join("");
    case "velocity":
      return Array.from({ length: 12 }, (_, i) => `<rect x="${40 + i * 130}" y="${180 + i * 18}" width="${220 - i * 8}" height="6" fill="${spec.a}" opacity=".16"/>`).join("");
    case "longshot":
      return `<rect x="80" y="430" width="1440" height="8" fill="${spec.a}" opacity=".2"/>
        <circle cx="1400" cy="434" r="70" fill="none" stroke="${spec.b}" stroke-opacity=".25" stroke-width="6"/>`;
    case "chrome":
      return `<rect x="0" y="0" width="1600" height="900" fill="url(#chromeGrad)" opacity=".25"/>`;
    case "magma":
      return `<path d="M0,900 Q300,500 600,900 T1200,900 T1600,700 V900 Z" fill="${spec.a}" opacity=".2"/>`;
    case "lotus":
      return `<ellipse cx="800" cy="700" rx="280" ry="40" fill="${spec.a}" opacity=".15"/>
        <path d="M800,680 Q640,420 800,240 Q960,420 800,680" fill="${spec.b}" opacity=".1"/>`;
    case "mirage":
      return `<path d="M0,700 Q400,520 800,700 T1600,620 V900 H0 Z" fill="${spec.a}" opacity=".16"/>
        <polygon points="1100,700 1220,360 1360,700" fill="${spec.b}" opacity=".12"/>`;
    case "pulse":
      return `<polyline points="0,450 200,450 280,220 360,680 460,450 1600,450" fill="none" stroke="${spec.a}" stroke-width="6" opacity=".2"/>`;
    case "hex":
      return Array.from({ length: 10 }, (_, i) => {
        const x = 80 + (i % 5) * 320;
        const y = 100 + Math.floor(i / 5) * 380;
        return `<polygon points="${x + 80},${y} ${x + 160},${y + 50} ${x + 160},${y + 150} ${x + 80},${y + 200} ${x},${y + 150} ${x},${y + 50}" fill="none" stroke="${spec.a}" stroke-opacity=".16" stroke-width="3"/>`;
      }).join("");
    case "meteor":
      return `<circle cx="1280" cy="180" r="50" fill="${spec.a}" opacity=".4"/>
        <line x1="1280" y1="180" x2="200" y2="820" stroke="${spec.b}" stroke-width="10" opacity=".2"/>`;
    case "stormfront":
      return `<path d="M0,160 Q400,80 800,200 T1600,120" fill="none" stroke="${spec.a}" stroke-width="18" opacity=".12"/>
        <polyline points="900,120 860,260 980,250 820,430" fill="none" stroke="${spec.b}" stroke-width="6" opacity=".25"/>`;
    case "aurora":
      return `<path d="M0,280 Q400,80 800,240 T1600,160" fill="none" stroke="${spec.a}" stroke-width="28" opacity=".18"/>
        <path d="M0,340 Q500,180 1000,300 T1600,240" fill="none" stroke="${spec.b}" stroke-width="22" opacity=".14"/>`;
    case "ivory":
      return `<ellipse cx="400" cy="200" rx="80" ry="200" fill="${spec.a}" opacity=".12"/>
        <ellipse cx="1240" cy="300" rx="70" ry="220" fill="${spec.b}" opacity=".12"/>`;
    case "singularity":
      return `<circle cx="800" cy="450" r="40" fill="#000"/>
        <circle cx="800" cy="450" r="180" fill="none" stroke="${spec.a}" stroke-width="10" opacity=".2"/>
        <circle cx="800" cy="450" r="320" fill="none" stroke="${spec.b}" stroke-width="4" opacity=".16" stroke-dasharray="12 16"/>`;
    case "sling":
      return `<path d="M200,200 Q800,80 1400,260" fill="none" stroke="${spec.a}" stroke-width="8" opacity=".18"/>
        <polygon points="1400,260 1360,220 1440,240" fill="${spec.b}" opacity=".3"/>`;
    case "commando":
      return `<rect x="80" y="80" width="1440" height="18" fill="${spec.a}" opacity=".15"/>
        <rect x="80" y="802" width="1440" height="18" fill="${spec.b}" opacity=".15"/>
        <text x="120" y="160" fill="${spec.a}" opacity=".15" font-size="48" font-family="Impact,sans-serif">RESTRICTED</text>`;
    case "city":
      return [90, 140, 70, 200, 110, 160, 80, 180, 95, 150]
        .map((h, i) => `<rect x="${80 + i * 150}" y="${900 - h * 3}" width="100" height="${h * 3}" fill="${i % 2 ? spec.a : spec.b}" opacity=".12"/>`)
        .join("");
    case "fracture":
      return `<polyline points="80,80 400,300 200,500 900,820" fill="none" stroke="${spec.a}" stroke-width="8" opacity=".2"/>
        <polyline points="1500,40 1100,280 1400,520 700,860" fill="none" stroke="${spec.b}" stroke-width="8" opacity=".18"/>`;
    default:
      return `<circle cx="200" cy="200" r="160" fill="${spec.a}" opacity=".1"/>`;
  }
}

function backgroundSvg(spec) {
  const gid = uid(spec, "bg");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${spec.name} opening backdrop">
  <!-- prismloot:${spec.id}:background -->
  <defs>
    <radialGradient id="${gid}v" cx="50%" cy="40%" r="75%">
      <stop offset="0" stop-color="${rgba(spec.a, 0.28)}"/>
      <stop offset=".55" stop-color="#08080e"/>
      <stop offset="1" stop-color="#050507"/>
    </radialGradient>
    <linearGradient id="chromeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${spec.a}"/><stop offset="1" stop-color="${spec.b}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="#050507"/>
  <rect width="1600" height="900" fill="url(#${gid}v)"/>
  <circle cx="220" cy="120" r="280" fill="${spec.b}" opacity=".08"/>
  <circle cx="1400" cy="760" r="320" fill="${spec.a}" opacity=".08"/>
  ${bgShapes(spec)}
  ${spec.premium ? `<rect x="24" y="24" width="1552" height="852" rx="28" fill="none" stroke="${spec.a}" stroke-opacity=".18" stroke-width="2"/>` : ""}
</svg>`;
}

function fallbackKit() {
  const spec = { id: "_fallback", name: "Unknown Crate", plat: "PL", a: "#2ee9ff", b: "#e14aff", body: "weapon", motif: "prism", premium: false, scene: "studio-prism" };
  return { spec, caseArt: caseSvg(spec, "hero"), thumb: caseSvg(spec, "thumb"), bg: backgroundSvg(spec) };
}

function writeKit(dir, spec) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "case.svg"), caseSvg(spec, "hero"));
  writeFileSync(join(dir, "thumbnail.svg"), caseSvg(spec, "thumb"));
  writeFileSync(join(dir, "background.svg"), backgroundSvg(spec));
}

for (const spec of SPECS) {
  writeKit(join(OUT, spec.id), spec);
}
const fb = fallbackKit();
writeKit(join(OUT, "_fallback"), fb.spec);

console.log(`Wrote ${SPECS.length} case kits + fallback → ${OUT}`);
export { SPECS };
