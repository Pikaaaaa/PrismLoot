"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { BalanceWidget } from "@/components/ui/BalanceWidget";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { PrismLogo } from "@/components/visuals/ParticleField";
import { NAV_MAIN } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import type { CurrencyCode } from "@/lib/types";
import { DISPLAY_CURRENCIES } from "@/lib/ui/catalog";
import { cn, formatBalance, formatMoney } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  History,
  LifeBuoy,
  LogOut,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type NavItem = { href: string; label: string };
type MenuLink = NavItem & { icon: LucideIcon };

/** Bar destinations the shell owns that NAV_MAIN does not carry yet. */
const SHELL_NAV: NavItem[] = [{ href: "/inventory", label: "Inventory" }];

const BAR_ORDER = ["/", "/upgrade", "/contracts", "/inventory"];

function buildBarNav(): NavItem[] {
  const byHref = new Map<string, NavItem>();
  for (const item of [...NAV_MAIN, ...SHELL_NAV]) {
    if (!byHref.has(item.href)) byHref.set(item.href, { href: item.href, label: item.label });
  }
  const ordered: NavItem[] = [];
  for (const href of BAR_ORDER) {
    const item = byHref.get(href);
    if (!item) continue;
    byHref.delete(href);
    ordered.push(item);
  }
  return [...ordered, ...byHref.values()];
}

const BAR_NAV = buildBarNav();

const PROFILE_NAV: MenuLink[] = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/deposit", label: "Deposit", icon: Wallet },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/fairness", label: "Fairness", icon: ShieldCheck },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

const MENU_ICON = "h-4 w-4 shrink-0";

/** Square 2rem control, the height every item in the right cluster snaps to. */
const ICON_BUTTON =
  "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-sm)] border text-soft transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]";

/** Full-height bar tab. Active state is accent text plus a 2px accent underline. */
const BAR_TAB =
  "relative inline-flex h-full shrink-0 items-center whitespace-nowrap px-2.5 text-[0.8125rem] font-semibold transition-[background-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]";

function navActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Menu-button pattern: click or ArrowDown opens and moves focus into the panel,
 * arrows/Home/End walk the rows, Escape returns focus to the trigger, and an
 * outside pointer dismisses. Rows dismiss themselves so navigation never leaves
 * an orphaned panel behind.
 */
function HeaderMenu({
  label,
  triggerClass,
  triggerContent,
  children,
  rootClassName,
  panelClassName,
  align = "end",
}: {
  label: string;
  triggerClass: (open: boolean) => string;
  triggerContent: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  rootClassName?: string;
  panelClassName?: string;
  align?: "start" | "end";
}) {
  const { reduceMotion } = useAppStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const rows = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    [],
  );

  const dismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) rows()[0]?.focus();
  }, [open, rows]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const items = rows();
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative h-full items-center", rootClassName)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClass(open)}
      >
        {triggerContent(open)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="menu"
            aria-label={label}
            onKeyDown={onPanelKeyDown}
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "glass-strong absolute top-full z-50 mt-1.5 w-56 rounded-[var(--radius-md)] p-1 shadow-[var(--shadow-lg)]",
              align === "end" ? "right-0" : "left-0",
              panelClassName,
            )}
          >
            {children(dismiss)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuRow({
  href,
  icon,
  children,
  onSelect,
  active,
  tone = "default",
}: {
  href?: string;
  icon?: ReactNode;
  children: ReactNode;
  onSelect?: () => void;
  active?: boolean;
  tone?: "default" | "danger";
}) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-[var(--radius-xs)] px-2.5 py-2 text-left text-[0.8125rem] font-semibold",
    "transition-[background-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]",
    tone === "danger"
      ? "text-danger hover:bg-danger/15"
      : active
        ? "bg-white/[0.06] text-cyan"
        : "text-soft hover:bg-white/[0.06] hover:text-ink",
  );

  const body = (
    <>
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link
        role="menuitem"
        tabIndex={-1}
        href={href}
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {body}
      </Link>
    );
  }

  return (
    <button role="menuitem" tabIndex={-1} type="button" onClick={onSelect} className={className}>
      {body}
    </button>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, balance, wagerRemainingUsd, logout, displayCurrency, setCurrency } = useAppStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-x-0 border-t-0 border-b bg-void",
          scrolled ? "border-line-strong shadow-[var(--shadow-sm)]" : "border-line",
        )}
      >
        <div className="page-wrap flex h-[var(--header-h)] items-center gap-2">
          <Link href="/" aria-label="PrismLoot home" className="flex shrink-0 items-center gap-1.5">
            <PrismLogo className="h-6 w-6" />
            <span className="font-display text-[0.8125rem] font-extrabold tracking-tight">
              Prism<span className="text-mute">Loot</span>
            </span>
          </Link>

          <span className="hidden h-full min-w-0 lg:contents">
            <nav aria-label="Main" className="flex h-full min-w-0 items-center overflow-hidden">
            {BAR_NAV.map((item) => {
              const active = navActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    BAR_TAB,
                    active ? "text-cyan" : "text-soft hover:bg-white/[0.04] hover:text-ink",
                  )}
                >
                  {item.label}
                  {active && (
                    <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-cyan" />
                  )}
                </Link>
              );
            })}
            </nav>
          </span>

          <div className="ml-auto flex h-full min-w-0 items-center gap-1.5">
            <BalanceWidget balance={user ? balance : 0} wagerRemainingUsd={user ? wagerRemainingUsd : 0} href="/deposit" />
            {user ? (
              <Link href="/deposit" className="hidden shrink-0 lg:inline-flex">
                <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                  Deposit
                </Button>
              </Link>
            ) : (
              <Button size="sm" onClick={() => setLoginOpen(true)}>
                Sign in with Steam
              </Button>
            )}

            <select
              aria-label="Display currency"
              value={displayCurrency}
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
              className="field hidden h-8 w-[4.5rem] shrink-0 cursor-pointer px-2 text-[0.75rem] font-semibold lg:block"
            >
              {DISPLAY_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>

            <span className="hidden h-full lg:contents">
              <HeaderMenu
                label="Notifications"
                rootClassName="flex"
                triggerClass={(open) =>
                  cn(
                    ICON_BUTTON,
                    open
                      ? "border-line-strong bg-white/[0.05] text-ink"
                      : "border-line hover:border-line-strong hover:bg-white/[0.05] hover:text-ink",
                  )
                }
                triggerContent={() => <Bell className="h-4 w-4" />}
              >
                {() => (
                  <EmptyState
                    compact
                    title="No notifications"
                    detail="Drops, battle results and payouts land here."
                  />
                )}
              </HeaderMenu>
            </span>

            {user && (
              <HeaderMenu
                label="Account menu"
                rootClassName="flex"
                panelClassName="w-60"
                triggerClass={(open) =>
                  cn(
                    "inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border py-0.5 pl-0.5 pr-1.5",
                    "transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease)]",
                    open ? "border-line-strong bg-white/[0.05]" : "border-transparent hover:border-line",
                  )
                }
                triggerContent={(open) => (
                  <>
                    <UserAvatar name={user.username} hue={user.avatarHue} src={user.avatarUrl} size="xs" />
                    <span className="hidden max-w-[7.5rem] truncate text-[0.75rem] font-semibold text-ink sm:inline">
                      {user.username}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-mute transition-transform duration-[var(--dur-fast)] ease-[var(--ease)]",
                        open && "rotate-180",
                      )}
                    />
                  </>
                )}
              >
                {(close) => (
                  <>
                    <div className="flex items-center gap-2.5 px-2.5 py-2">
                      <UserAvatar name={user.username} hue={user.avatarHue} src={user.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] font-bold text-ink">{user.username}</p>
                        <p className="meta truncate">
                          Level {user.level} · {formatBalance(balance)}
                          {wagerRemainingUsd > 0 ? ` · playthrough ${formatMoney(wagerRemainingUsd)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="divider my-1" />
                    {PROFILE_NAV.map((item) => (
                      <MenuRow
                        key={item.href}
                        href={item.href}
                        icon={<item.icon className={MENU_ICON} />}
                        active={navActive(item.href, pathname)}
                        onSelect={close}
                      >
                        {item.label}
                      </MenuRow>
                    ))}
                    <div className="divider my-1" />
                    <MenuRow
                      tone="danger"
                      icon={<LogOut className={MENU_ICON} />}
                      onSelect={() => {
                        close();
                        logout();
                      }}
                    >
                        Log out
                    </MenuRow>
                  </>
                )}
              </HeaderMenu>
            )}
          </div>
        </div>
      </header>

      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title="Sign in with Steam">
        <LoginForm />
      </Modal>
    </>
  );
}
