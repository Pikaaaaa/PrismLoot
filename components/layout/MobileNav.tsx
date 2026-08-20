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
 * The bar is a 3.5rem row plus the safe-area inset. AppShell reserves the same
 * amount under the page so the last row of content is never trapped behind it.
 */
export const MOBILE_NAV_SPACER = "pb-[calc(3.5rem_+_env(safe-area-inset-bottom)_+_1rem)] lg:pb-8";

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
      <ul className="flex h-14 items-stretch">
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1",
                  "text-[0.6875rem] font-semibold transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                  active ? "text-cyan" : "text-mute active:text-ink",
                )}
              >
                {active && (
                  <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-cyan" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
