"use client";

import { Button } from "@/components/ui/Button";
import { PrismLogo } from "@/components/visuals/ParticleField";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { CASES, SKINS, SKIN_MAP } from "@/lib/mock-data";
import { RARITY_META, rarityRank } from "@/lib/rarity";
import type { Skin } from "@/lib/types";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

/** Back to front. The last layer is the only one that survives on mobile. */
const LAYERS = [
  { area: "left-[1%] top-[27%] w-[42%]", rotate: -13, depth: 0.62, float: 9.5, delay: 0.9 },
  { area: "left-[57%] top-[31%] w-[42%]", rotate: 14, depth: 0.62, float: 8.5, delay: 0.45 },
  { area: "left-[27%] top-[1%] w-[46%]", rotate: -5, depth: 0.82, float: 10.5, delay: 1.3 },
  { area: "left-[19%] top-[29%] w-[62%]", rotate: 4, depth: 1, float: 7.5, delay: 0 },
] as const;

const MIN_HERO_RARITY = rarityRank("legendary");

/**
 * Real catalog art, picked deterministically: the top-grade featured reward of
 * the most expensive crates. No random ordering, so SSR and CSR agree.
 */
function heroSkins(): Skin[] {
  const seen = new Set<string>();
  const picks: Skin[] = [];
  for (const crate of [...CASES].sort((a, b) => b.price - a.price)) {
    const skin = SKIN_MAP[crate.featuredReward];
    if (!skin || seen.has(skin.id)) continue;
    if (rarityRank(skin.rarity) < MIN_HERO_RARITY) continue;
    seen.add(skin.id);
    picks.push(skin);
    if (picks.length === LAYERS.length) break;
  }
  return picks;
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="price tabular text-base">{value}</p>
      <p className="label mt-0.5 truncate">{label}</p>
    </div>
  );
}

export function HomeHero() {
  const reduceMotion = useReducedMotion();
  const skins = heroSkins();
  const lead = skins[skins.length - 1];
  const leadGlow = lead ? RARITY_META[lead.rarity].glow : "transparent";

  return (
    <section className="surface relative overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(78% 120% at 8% -10%, color-mix(in srgb, var(--color-cyan) 11%, transparent), transparent 58%)",
        }}
      />

      <div className="relative grid gap-6 p-5 sm:p-7 lg:min-h-[21rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:items-center lg:gap-10 lg:p-9">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-3">
            <PrismLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" pulse />
            <div className="min-w-0">
              <p className="font-display text-[length:var(--type-h2)] font-extrabold tracking-tight">
                Prism<span className="text-mute">Loot</span>
              </p>
              <p className="label mt-0.5">Provably fair CS2 unboxing</p>
            </div>
          </div>
          <h1 className="mt-4 text-[length:var(--type-display)]">
            Open CS2 cases, keep every drop.
          </h1>
          <p className="mt-3 max-w-md text-sm text-soft">
            PrismLoot is a case-opening platform for CS2 skins — pick a crate, see the exact odds
            before you spend, and send whatever you unbox straight to your vault or into an upgrade.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href="#cases">
              <Button size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                Open a case
              </Button>
            </Link>
            <Link href="/fairness">
              <Button size="lg" variant="ghost" icon={<ShieldCheck className="h-4 w-4" />}>
                How it works
              </Button>
            </Link>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4">
            <HeroStat label="Cases live" value={String(CASES.length)} />
            <HeroStat label="Skins in catalog" value={SKINS.length.toLocaleString("en-US")} />
            <HeroStat label="Provably fair" value="100%" />
          </dl>
        </div>

        <div
          aria-hidden
          className="pointer-events-none relative hidden h-52 w-full select-none sm:block lg:h-[17rem]"
        >
          <PrismLogo className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 opacity-[0.07] lg:h-56 lg:w-56" />
          <span
            className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl lg:h-56 lg:w-56"
            style={{ background: leadGlow }}
          />
          {skins.map((skin, index) => {
            const layer = LAYERS[index];
            const isLead = index === skins.length - 1;
            return (
              <motion.div
                key={skin.id}
                className={`absolute ${layer.area} ${isLead ? "z-30" : "z-10 hidden lg:block"}`}
                animate={reduceMotion ? undefined : { y: [0, -9, 0] }}
                transition={{
                  duration: layer.float,
                  delay: layer.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div
                  className="aspect-[16/10]"
                  style={{
                    transform: `rotate(${layer.rotate}deg) scale(${layer.depth})`,
                    opacity: 0.4 + layer.depth * 0.6,
                    filter: `drop-shadow(0 18px 28px rgba(0,0,0,0.55))`,
                  }}
                >
                  <SkinVisual
                    skin={skin}
                    framed={false}
                    chrome={false}
                    showWear={false}
                    eager={isLead}
                    className="h-full w-full"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
