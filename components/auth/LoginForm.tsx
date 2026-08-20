"use client";

import { SignInActions } from "@/components/auth/SignInActions";
import { useLocalPlayAvailable } from "@/components/auth/LocalPlayButton";

export function LoginForm() {
  const localPlay = useLocalPlayAvailable();
  return (
    <div className="flex flex-col gap-3.5 text-left">
      <p className="text-sm text-mute">
        {localPlay
          ? "Steam OpenID, or a local session on this machine. PrismLoot never asks for a Steam password."
          : "Steam OpenID only. PrismLoot never asks for a Steam password."}
      </p>
      <SignInActions fullWidth size="lg" />
    </div>
  );
}
