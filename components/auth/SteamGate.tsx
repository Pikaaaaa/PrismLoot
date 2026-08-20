"use client";

import { SignInActions } from "@/components/auth/SignInActions";
import { useLocalPlayAvailable } from "@/components/auth/LocalPlayButton";
import { PrismLogo } from "@/components/visuals/ParticleField";

/** Prompt on locked play/account routes. Does not replace the public shell. */
export function SteamGate() {
  const localPlay = useLocalPlayAvailable();
  return (
    <div className="grid min-h-[50vh] place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <PrismLogo className="h-10 w-10" />
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight">
            {localPlay ? "Sign in to play" : "Sign in with Steam"}
          </p>
          <p className="mt-1.5 max-w-sm text-sm text-mute">
            Inventory, contracts, upgrades, and deposits need a signed-in account. PrismLoot never
            asks for a Steam password.
            {localPlay ? " On this machine you can start a local session instead." : ""}
          </p>
        </div>
        <SignInActions size="lg" />
      </div>
    </div>
  );
}
