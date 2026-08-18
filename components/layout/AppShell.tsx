"use client";

import { Header } from "@/components/layout/Header";
import { LiveDrop } from "@/components/layout/LiveDrop";
import { MobileNav } from "@/components/layout/MobileNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Toast } from "@/components/ui/Toast";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AppShell({
  children,
  hidePublicChrome = false,
}: {
  children: ReactNode;
  hidePublicChrome?: boolean;
}) {
  const pathname = usePathname();
  const { reduceMotion } = useAppStore();

  if (hidePublicChrome) {
    return (
      <>
        {children}
        <Toast />
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <LiveDrop />

      <motion.main
        key={pathname}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        className={cn("page-wrap flex-1 pt-4")}
      >
        {children}
      </motion.main>

      <SiteFooter />

      <MobileNav />
      <Toast />
    </div>
  );
}
