"use client";

import { SteamSignInButton } from "@/components/auth/SteamButton";
import { PrismLogo } from "@/components/visuals/ParticleField";

/** Prompt on locked play/account routes. Does not replace the public shell. */
export function SteamGate() {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <PrismLogo className="h-10 w-10" />
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight">Sign in with Steam</p>
          <p className="mt-1.5 max-w-sm text-sm text-mute">
            Inventory, contracts, upgrades, and deposits need a Steam account. PrismLoot never asks
            for a Steam password.
          </p>
        </div>
        <SteamSignInButton size="lg" />
      </div>
    </div>
  );
}
