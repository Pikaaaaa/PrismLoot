"use client";

import { SteamSignInButton } from "@/components/auth/SteamButton";

export function LoginForm() {
  return (
    <div className="flex flex-col gap-3.5 text-left">
      <p className="text-sm text-mute">
        Steam OpenID only. PrismLoot never asks for a Steam password.
      </p>
      <SteamSignInButton fullWidth size="lg" />
    </div>
  );
}
