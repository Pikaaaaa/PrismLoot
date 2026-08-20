"use client";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { House, Layers, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/upgrade", label: "Upgrade", icon: Sparkles },
  { href: "/contracts", label: "Contracts", icon: Layers },
] as const;

/**
 * Compact mobile dock: 2.75rem row + safe-area. Keep AppShell / footer spacers in sync.
 */
export const MOBILE_NAV_SPACER = "pb-[calc(2.75rem_+_env(safe-area-inset-bottom)_+_0.75rem)] lg:pb-8";

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAppStore();
  const items = user ? ITEMS : ITEMS.filter((item) => item.href === "/");

  return (
    <nav
      aria-label="Primary"
      className="glass-strong fixed inset-x-0 bottom-0 z-50 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex h-11 items-stretch">
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1",
                  "text-[0.625rem] font-semibold leading-none transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                  active ? "text-cyan" : "text-mute active:text-ink",
                )}
              >
                {active && (
                  <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-cyan" />
                )}
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
