"use client";

import { SKIN_MAP } from "@/data/skins";
import { RARITY_META } from "@/lib/rarity";
import type { Crate, Rarity, Skin, Weapon } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState, type CSSProperties } from "react";

/**
 * Case art is composed at render time rather than shipped as 40 baked images:
 * a themed backdrop, one of three shared 3D crate renders (glow tinted toward
 * the case accent), and the crate's own featured skin rising out of the lid.
 */

const CRATE_TIER = {
  standard: "/assets/cases/_base/crate-standard.png",
  elite: "/assets/cases/_base/crate-elite.png",
  gold: "/assets/cases/_base/crate-gold.png",
} as const;

type Tier = keyof typeof CRATE_TIER;

/** Baked interior-glow hues of the three shared crate renders. */
const TIER_GLOW_HUE = { standard: 174, elite: 275, gold: 45 } as const;

const GOLD_SECTIONS = new Set(["luxury", "high-tier"]);
const ELITE_SECTIONS = new Set(["knives", "gloves", "premium"]);

const PISTOLS = new Set<Weapon>([
  "Glock-18",
  "USP-S",
  "Desert Eagle",
  "P250",
  "Five-SeveN",
  "Tec-9",
  "CZ75-Auto",
  "Dual Berettas",
  "P2000",
  "R8 Revolver",
]);

const LONG_GUNS = new Set<Weapon>([
  "AWP",
  "AK-47",
  "M4A4",
  "M4A1-S",
  "SSG 08",
  "G3SG1",
  "SCAR-20",
  "SG 553",
  "AUG",
]);

type Silhouette = "long" | "mid" | "compact";

function crateTier(crate: Crate): Tier {
  if (GOLD_SECTIONS.has(crate.section) || crate.price >= 600) return "gold";
  if (ELITE_SECTIONS.has(crate.section) || crate.price >= 120) return "elite";
  return "standard";
}

/** Highest grade actually present in the pool — drives the backdrop glow. */
function topRarity(crate: Crate): Rarity {
  const order: Rarity[] = ["ultrarare", "mythic", "legendary", "epic", "rare", "uncommon", "common"];
  for (const r of order) {
    if (crate.rewards.some((reward) => reward.rarity === r)) return r;
  }
  return "common";
}

function collectSkins(crate: Crate): Skin[] {
  const seen = new Set<string>();
  const out: Skin[] = [];
  const push = (id: string | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const skin = SKIN_MAP[id];
    if (skin?.image) out.push(skin);
  };
  push(crate.featuredReward);
  const ranked = [...crate.rewards].sort((a, b) => b.value - a.value);
  for (const reward of ranked) push(reward.skinId);
  return out;
}

function silhouette(weapon: Weapon | undefined): Silhouette {
  if (!weapon) return "mid";
  if (weapon === "Gloves" || weapon === "Karambit" || weapon === "Shadow Daggers") return "compact";
  if (weapon.includes("Knife") || weapon.includes("Bayonet")) return "compact";
  if (PISTOLS.has(weapon)) return "compact";
  if (LONG_GUNS.has(weapon)) return "long";
  return "mid";
}

function parseHex(hex: string) {
  const raw = hex.replace("#", "");
  const h = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hexHue(hex: string) {
  const { r, g, b } = parseHex(hex);
  return rgbToHsl(r, g, b);
}

/** Prefer the case accent; fall back when it is too dark, pale, or grey to tint a glow. */
function tintHex(crate: Crate, rarityColor: string) {
  const pick = (hex: string) => {
    const { s, l } = hexHue(hex);
    return s >= 0.18 && l >= 0.16 && l <= 0.86 ? hex : undefined;
  };
  return pick(crate.accent) ?? pick(crate.accent2) ?? rarityColor;
}

function hueDelta(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

function crateGlowFilter(tier: Tier, tint: string) {
  const { h, s } = hexHue(tint);
  let delta = hueDelta(TIER_GLOW_HUE[tier], h);
  if (tier === "gold") delta = Math.max(-22, Math.min(22, delta));
  const sat = s < 0.22 ? 0.92 : tier === "gold" ? 1.06 : 1.12;
  return `hue-rotate(${delta.toFixed(1)}deg) saturate(${sat})`;
}

function seedFromId(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** High product-shot slot: bursting from the open lid, not covering the front plate. */
const SKIN_BOX: Record<Silhouette, string> = {
  long: "left-[8%] right-[8%] top-[10%] h-[47%]",
  mid: "left-[12%] right-[12%] top-[9%] h-[48%]",
  compact: "left-[14%] right-[14%] top-[8%] h-[50%]",
};

/** Same high band on the square hero. Width only changes by silhouette — never a lower melee slot. */
const SKIN_BOX_HERO: Record<Silhouette, string> = {
  long: "left-[8%] right-[8%] top-[12%] h-[46%]",
  mid: "left-[12%] right-[12%] top-[11%] h-[48%]",
  compact: "left-[14%] right-[14%] top-[10%] h-[50%]",
};

function Backdrop({ crate, glow, tint, seed }: { crate: Crate; glow: string; tint: string; seed: number }) {
  const rot = (seed % 21) - 10;
  const kind = seed % 3;
  const ox = 46 + ((seed >> 2) % 9);
  const oy = 4 + ((seed >> 5) % 8);
  const wash2x = 100 - ox;

  const pattern =
    kind === 0
      ? `repeating-linear-gradient(${rot}deg, transparent 0 15px, rgba(255,255,255,0.03) 15px 16px), repeating-linear-gradient(${rot + 90}deg, transparent 0 15px, rgba(255,255,255,0.03) 15px 16px)`
      : kind === 1
        ? `repeating-linear-gradient(${36 + rot}deg, transparent 0 18px, rgba(255,255,255,0.032) 18px 19px)`
        : `radial-gradient(circle, rgba(255,255,255,0.05) 0.8px, transparent 1.15px)`;

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 88% at ${ox}% ${oy}%, ${tint}36, transparent 64%), radial-gradient(88% 72% at ${wash2x}% 108%, ${crate.accent2}34, transparent 66%), linear-gradient(180deg, #121218 0%, #0a0a0c 100%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: pattern,
          backgroundSize: kind === 2 ? "17px 17px" : undefined,
        }}
      />
      <div
        className="absolute left-1/2 top-[44%] h-[54%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: glow, opacity: 0.46 }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_50%,transparent_42%,rgba(0,0,0,0.58)_100%)]" />
    </>
  );
}

function CrateLayer({ src, tier, tint, eager }: { src: string; tier: Tier; tint: string; eager: boolean }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (broken) return null;

  const blend: CSSProperties = {
    background: tint,
    mixBlendMode: tier === "gold" ? "overlay" : "color",
    opacity: tier === "gold" ? 0.22 : 0.38,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "bottom center",
    maskPosition: "bottom center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };

  return (
    <div className="relative h-full w-full isolate">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="h-full w-full object-contain object-bottom"
        style={{ filter: crateGlowFilter(tier, tint) }}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setBroken(true)}
      />
      <span className="pointer-events-none absolute inset-0" style={blend} aria-hidden />
    </div>
  );
}

export function CaseVisual({
  crate,
  className,
  size = "card",
}: {
  crate: Crate;
  className?: string;
  size?: "card" | "hero" | "compact";
}) {
  const candidates = collectSkins(crate);
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    setFailed(0);
  }, [crate.id]);

  const skin = size === "compact" ? undefined : candidates[failed];
  const tier = crateTier(crate);
  const rarity = topRarity(crate);
  const rarityColor = RARITY_META[rarity].color;
  const tint = tintHex(crate, rarityColor);
  const eager = size === "hero";
  const crateSrc = CRATE_TIER[tier];
  const shape = silhouette(skin?.weapon);
  const withBackdrop = size !== "hero";

  const sizeClass =
    size === "compact"
      ? "h-16 w-16"
      : size === "hero"
        ? "h-64 w-64 sm:h-72 sm:w-72 bg-transparent"
        : "h-full w-full min-h-0";

  const crateBox =
    size === "compact"
      ? "absolute inset-x-0 bottom-0 h-[92%]"
      : size === "hero"
        ? "absolute inset-x-[6%] bottom-[3%] h-[72%] drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
        : "absolute inset-x-[8%] bottom-[2%] h-[72%] drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]";

  return (
    <div className={cn("relative isolate", withBackdrop ? "overflow-hidden" : "overflow-visible bg-transparent", sizeClass, className)}>
      {withBackdrop ? (
        <Backdrop crate={crate} glow={`${rarityColor}55`} tint={tint} seed={seedFromId(crate.id)} />
      ) : null}

      <div className={crateBox}>
        <CrateLayer src={crateSrc} tier={tier} tint={tint} eager={eager} />
      </div>

      {skin?.image ? (
        <div
          className={cn(
            "absolute z-[1] flex items-center justify-center",
            size === "hero" ? SKIN_BOX_HERO[shape] : SKIN_BOX[shape],
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={skin.image}
            alt=""
            aria-hidden
            className="max-h-full max-w-full object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.65)]"
            referrerPolicy="no-referrer"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailed((n) => n + 1)}
          />
        </div>
      ) : null}

      <span className="sr-only">{crate.name} case</span>
    </div>
  );
}

/** Full-bleed themed wash used behind the case detail hero. */
export function CaseBackground({ crate, className }: { crate: Crate; className?: string }) {
  const rarity = topRarity(crate);
  const tint = tintHex(crate, RARITY_META[rarity].color);
  const seed = seedFromId(crate.id);
  const ox = 18 + (seed % 10);
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(70% 60% at ${ox}% 0%, ${tint}28, transparent 60%), radial-gradient(60% 60% at ${88 - (seed % 8)}% 10%, ${RARITY_META[rarity].color}1f, transparent 60%)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void/60 to-void" />
    </div>
  );
}
