"use client";

import { RarityChrome } from "@/components/ui/RarityChrome";
import { WEAR_META } from "@/lib/rarity";
import type { Skin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { WeaponSilhouette } from "./WeaponSilhouette";

export function SkinVisual({
  skin,
  className,
  featured,
  framed = true,
  chrome = true,
  showWear = true,
  eager = false,
  pad,
}: {
  skin: Skin;
  className?: string;
  featured?: boolean;
  /** Card chrome (radius, wear/ST). Off for circular wells. */
  framed?: boolean;
  /** CS2 rarity strip + bar. Parent SkinCard may own chrome instead. */
  chrome?: boolean;
  showWear?: boolean;
  eager?: boolean;
  /** Inner image padding. Unframed defaults leave room for long rifles. */
  pad?: number;
}) {
  const [broken, setBroken] = useState(false);

  // A recycled card (reel, grid virtualisation) must retry the new URL.
  useEffect(() => {
    setBroken(false);
  }, [skin.image]);

  const showImage = Boolean(skin.image) && !broken;

  return (
    <div
      className={cn(
        "relative",
        "overflow-hidden",
        framed && "rounded-2xl",
        framed && (featured ? "h-48" : "h-32"),
        !framed && "bg-transparent",
        className,
      )}
    >
      {framed && <div className="absolute inset-0 bg-graphite" />}
      {chrome ? <RarityChrome rarity={skin.rarity} /> : null}
      <div
        className="absolute inset-0 z-[1] box-border flex items-center justify-center"
        style={{ padding: pad ?? (framed ? 8 : 0) }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={skin.image}
            alt={skin.name}
            className="block h-full w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)]"
            style={{ objectFit: "contain", objectPosition: "center" }}
            referrerPolicy="no-referrer"
            loading={eager ? "eager" : "lazy"}
            onError={() => setBroken(true)}
          />
        ) : (
          <WeaponSilhouette
            weapon={skin.weapon}
            className="max-h-[78%] max-w-[78%] text-white/70 drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          />
        )}
      </div>
      {framed && skin.stattrak && (
        <span className="absolute left-2 top-2 z-[5] rounded-md bg-amber/90 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-void">
          ST
        </span>
      )}
      {framed && showWear && (
        <span className="absolute bottom-2 right-2 z-[5] rounded-md bg-void/75 px-1.5 py-0.5 text-[length:var(--type-micro)] font-semibold text-soft">
          {WEAR_META[skin.wear].short}
        </span>
      )}
    </div>
  );
}
