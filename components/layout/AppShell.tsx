"use client";

import { SteamGate } from "@/components/auth/SteamGate";
import { Header } from "@/components/layout/Header";
import { LiveDrop } from "@/components/layout/LiveDrop";
import { MobileNav } from "@/components/layout/MobileNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Toast } from "@/components/ui/Toast";
import { PrismLogo } from "@/components/visuals/ParticleField";
import { isSteamRequiredPath } from "@/lib/auth/gates";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AppShell({
  children,
  hasSession = false,
}: {
  children: ReactNode;
  /** Server-seen Steam cookie. Avoids flashing Sign in on a signed-in refresh. */
  hasSession?: boolean;
}) {
  const pathname = usePathname();
  const { reduceMotion, user, sessionReady } = useAppStore();
  const waitingOnSession = hasSession && !sessionReady && !user;
  const locked = !user && !waitingOnSession && isSteamRequiredPath(pathname);

  return (
    <div className="flex min-h-full flex-col">
      <Header hasSession={hasSession} />
      <LiveDrop />

      <motion.main
        key={locked ? "steam-gate" : pathname}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        className={cn("page-wrap flex-1 pt-4")}
      >
        {waitingOnSession ? (
          <div className="grid min-h-[50vh] place-items-center">
            <PrismLogo className="h-10 w-10" />
          </div>
        ) : locked ? (
          <SteamGate />
        ) : (
          children
        )}
      </motion.main>

      <SiteFooter signedIn={Boolean(user)} />

      {user ? <MobileNav /> : null}
      <Toast />
    </div>
  );
}
