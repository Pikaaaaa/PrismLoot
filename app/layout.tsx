import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { CONSOLE_REQUEST_HEADER } from "@/lib/admin/path";
import { getSessionUserId } from "@/lib/auth/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrismLoot — Open. Upgrade. Win.",
  description:
    "Premium CS2 case opening, upgrades and contracts. Operated by TRS infinity.",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const consoleUi = headerList.get(CONSOLE_REQUEST_HEADER) === "1";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full`}
    >
      <body className="min-h-full">
        {consoleUi ? children : <PublicPages>{children}</PublicPages>}
      </body>
    </html>
  );
}

async function PublicPages({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  const { PublicApp } = await import("@/components/layout/PublicApp");
  return <PublicApp hasSession={Boolean(userId)}>{children}</PublicApp>;
}
