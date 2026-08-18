"use client";

import { AppShell } from "@/components/layout/AppShell";
import { AppStoreProvider } from "@/lib/store";
import type { ReactNode } from "react";

export function PublicApp({ children }: { children: ReactNode }) {
  return (
    <AppStoreProvider>
      <AppShell>{children}</AppShell>
    </AppStoreProvider>
  );
}
