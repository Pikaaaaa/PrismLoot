import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthed } from "@/lib/admin/auth";
import { CONSOLE_REST_HEADER, consoleHref, getAdminBasePath } from "@/lib/admin/path";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminAuthed();
  const basePath = getAdminBasePath();
  const rest = (await headers()).get(CONSOLE_REST_HEADER) ?? "";
  const isLogin = rest === "/login";
  if (!authed && !isLogin) redirect(consoleHref(basePath, "/login"));
  if (authed && isLogin) redirect(basePath);

  return (
    <AdminShell authed={authed} basePath={basePath}>
      {children}
    </AdminShell>
  );
}
