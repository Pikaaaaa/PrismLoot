"use client";

import { LocalPlayButton } from "@/components/auth/LocalPlayButton";
import { SteamSignInButton } from "@/components/auth/SteamButton";
import { cn } from "@/lib/utils";

export function SignInActions({
  className,
  fullWidth,
  size = "sm",
  localLabel,
  steamLabel,
}: {
  className?: string;
  fullWidth?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  localLabel?: string;
  steamLabel?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        fullWidth ? "w-full flex-col items-stretch" : "flex-nowrap",
        className,
      )}
    >
      <LocalPlayButton size={size} fullWidth={fullWidth} label={localLabel} />
      <SteamSignInButton size={size} fullWidth={fullWidth} label={steamLabel} />
    </div>
  );
}
