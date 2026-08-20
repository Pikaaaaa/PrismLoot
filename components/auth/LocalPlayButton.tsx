"use client";

import { Button } from "@/components/ui/Button";
import { LOCAL_PLAY_PATH, isLoopbackHostname } from "@/lib/auth/local";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function localPlayVisible() {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window === "undefined") return false;
  return isLoopbackHostname(window.location.hostname);
}

export function useLocalPlayAvailable() {
  const [show, setShow] = useState(localPlayVisible);
  useEffect(() => {
    setShow(localPlayVisible());
  }, []);
  return show;
}

/** Dev/loopback only. The API still refuses this on Vercel / prismloot.biz. */
export function LocalPlayButton({
  className,
  fullWidth,
  size = "sm",
  label = "Play locally",
}: {
  className?: string;
  fullWidth?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  label?: string;
}) {
  const show = useLocalPlayAvailable();
  if (!show) return null;

  return (
    <Button
      href={LOCAL_PLAY_PATH}
      variant="secondary"
      size={size}
      fullWidth={fullWidth}
      className={cn(className)}
    >
      {label}
    </Button>
  );
}
