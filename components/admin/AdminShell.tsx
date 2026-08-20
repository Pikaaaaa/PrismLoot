"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { consoleHref, consoleRest } from "@/lib/admin/path";
import { AdminPathContext } from "@/components/admin/admin-path";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Ticket,
  Users,
  Wallet,
  Gift,
  ImageIcon,
  FlaskConical,
  Banknote,
  Box,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const MAIN = [
  { rest: "", label: "Dashboard", icon: LayoutDashboard },
  { rest: "/users", label: "Users", icon: Users },
  { rest: "/deposits", label: "Deposits", icon: Wallet },
  { rest: "/withdrawals", label: "Withdrawals", icon: Banknote },
  { rest: "/gift-cards", label: "Gift cards", icon: Gift },
  { rest: "/case-coupons", label: "Free cases", icon: Box },
  { rest: "/catalog", label: "Catalog", icon: Boxes },
  { rest: "/drops", label: "Drops", icon: Package },
  { rest: "/promos", label: "Promos", icon: Ticket },
  { rest: "/audit", label: "Audit", icon: ScrollText },
];

const LABS = [
  { rest: "/economy", label: "Economy", icon: FlaskConical },
  { rest: "/prices", label: "Prices", icon: Wallet },
  { rest: "/assets", label: "Artwork", icon: ImageIcon },
];

function active(href: string, pathname: string, basePath: string) {
  if (href === basePath) {
    return pathname === basePath || pathname === "/admin" || pathname === "/xopl";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  items,
  pathname,
  basePath,
}: {
  items: typeof MAIN;
  pathname: string;
  basePath: string;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const href = consoleHref(basePath, item.rest);
        const on = active(href, pathname, basePath);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold",
              "transition-[background-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]",
              on ? "bg-cyan/12 text-cyan" : "text-soft hover:bg-white/[0.05] hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  authed,
  basePath,
  children,
}: {
  authed: boolean;
  basePath: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const rest = consoleRest(pathname, basePath);
  const isLogin = rest === "/login";

  useEffect(() => {
    if (!authed && !isLogin) router.replace(consoleHref(basePath, "/login"));
    if (authed && isLogin) router.replace(basePath);
  }, [authed, isLogin, router, basePath]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace(consoleHref(basePath, "/login"));
    router.refresh();
  }

  return (
    <AdminPathContext.Provider value={basePath}>
      {isLogin || !authed ? (
        <div className="min-h-full bg-void">{children}</div>
      ) : (
        <div className="flex min-h-full bg-void">
          <div className="hidden lg:block">
            <aside className="flex h-full min-h-screen w-56 flex-col border-r border-line bg-graphite px-3 py-5">
              <p className="label px-3">Console</p>
              <div className="mt-6">
                <NavList items={MAIN} pathname={pathname} basePath={basePath} />
              </div>
              <p className="label mt-8 px-3">Labs</p>
              <div className="mt-2">
                <NavList items={LABS} pathname={pathname} basePath={basePath} />
              </div>
              <div className="mt-auto px-1 pt-6">
                <Button size="sm" variant="ghost" fullWidth icon={<LogOut className="h-3.5 w-3.5" />} onClick={() => void logout()}>
                  Sign out
                </Button>
              </div>
            </aside>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="lg:hidden">
              <header className="flex items-center gap-2 overflow-x-auto border-b border-line bg-graphite px-3 py-2">
                <ClipboardList className="h-4 w-4 shrink-0 text-cyan" />
                <span className="shrink-0 text-sm font-semibold">Console</span>
                <div className="flex gap-1">
                  {[...MAIN, ...LABS].map((item) => {
                    const href = consoleHref(basePath, item.rest);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                          active(href, pathname, basePath) ? "bg-cyan/12 text-cyan" : "text-mute",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </header>
            </div>
            <div className="page-wrap flex-1 py-6">{children}</div>
          </div>
        </div>
      )}
    </AdminPathContext.Provider>
  );
}
