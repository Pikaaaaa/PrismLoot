"use client";

import { SteamSignInButton } from "@/components/auth/SteamButton";
import { PrismLogo } from "@/components/visuals/ParticleField";

/** Logged-out public surface: logo + Steam only. No nav, catalog, or balance. */
export function SteamGate() {
  return (
    <div className="grid min-h-full place-items-center px-6">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2.5">
          <PrismLogo className="h-10 w-10" />
          <span className="font-display text-xl font-extrabold tracking-tight">
            Prism<span className="text-mute">Loot</span>
          </span>
        </div>
        <SteamSignInButton size="lg" />
      </div>
    </div>
  );
}
