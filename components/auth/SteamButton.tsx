"use client";

import { Button } from "@/components/ui/Button";
import { STEAM_LOGIN_PATH } from "@/lib/auth/steam";
import { cn } from "@/lib/utils";

function SteamMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 .4 0 .8.1 1.2l5.3-2.2a3.4 3.4 0 0 1 6.4-.7l4.5 1.8A6.3 6.3 0 0 0 12 1.5Zm-3.2 9.2-4.3 1.8A10.5 10.5 0 0 0 12 22.5c5.8 0 10.5-4.7 10.5-10.5 0-.7-.1-1.4-.2-2.1l-4.8-1.9a4.6 4.6 0 0 1-8.7 2.2Zm3.2 1.1a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z" />
    </svg>
  );
}

export function SteamSignInButton({
  className,
  fullWidth,
  size = "sm",
  label = "Sign in with Steam",
}: {
  className?: string;
  fullWidth?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  label?: string;
}) {
  return (
    <Button
      type="button"
      size={size}
      fullWidth={fullWidth}
      className={cn(className)}
      icon={<SteamMark className="h-4 w-4" />}
      onClick={() => {
        window.location.assign(STEAM_LOGIN_PATH);
      }}
    >
      {label}
    </Button>
  );
}
