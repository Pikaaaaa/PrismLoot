"use client";

import { AppShell } from "@/components/layout/AppShell";
import { AppStoreProvider } from "@/lib/store";
import type { ReactNode } from "react";

export function PublicApp({
  children,
  hasSession,
}: {
  children: ReactNode;
  hasSession: boolean;
}) {
  return (
    <AppStoreProvider>
      <AppShell hasSession={hasSession}>{children}</AppShell>
    </AppStoreProvider>
  );
}
