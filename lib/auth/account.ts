import { DISCONNECTED_STEAM, type SteamIdentity } from "@/lib/auth/steam";
import type { CurrencyCode, PublicUser } from "@/lib/types";

export function hueFromKey(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return Math.abs(hash) % 360;
}

export function publicUserFromAccount(input: {
  id: string;
  displayName: string;
  steamId?: string | null;
  avatarUrl?: string | null;
}): PublicUser {
  return {
    id: input.id,
    username: input.displayName,
    avatarHue: hueFromKey(input.steamId || input.id),
    level: 1,
    avatarUrl: input.avatarUrl?.trim() || null,
    steamId: input.steamId ?? null,
  };
}

/**
 * Firebase-ready user document. Field names match a future Firestore `users/{uid}`
 * doc so a swap later is a mapper, not a redesign. No Firebase SDK is required
 * (or imported) in this demo.
 */
export type AccountRecord = {
  uid: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  avatarHue: number;
  level: number;
  createdAt: number;
  updatedAt: number;
  steam: SteamIdentity;
  tradeUrl: string;
  promoCode: string | null;
  displayCurrency: CurrencyCode;
  provider: "password" | "steam-openid";
};

export function accountFromSession(input: {
  user: PublicUser;
  email: string | null;
  emailVerified?: boolean;
  steam?: SteamIdentity;
  tradeUrl: string;
  promoCode: string | null;
  displayCurrency: CurrencyCode;
  createdAt?: number;
}): AccountRecord {
  const now = Date.now();
  return {
    uid: input.user.id,
    username: input.user.username,
    email: input.email,
    emailVerified: input.emailVerified ?? false,
    avatarHue: input.user.avatarHue,
    level: input.user.level,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    steam: input.steam ?? DISCONNECTED_STEAM,
    tradeUrl: input.tradeUrl,
    promoCode: input.promoCode,
    displayCurrency: input.displayCurrency,
    provider: "password",
  };
}

export function looksLikeTradeUrl(url: string) {
  const t = url.trim();
  if (t.length < 16 || t.length > 400) return false;
  if (!/^https?:\/\//i.test(t)) return false;
  return /steamcommunity\.com\/tradeoffer/i.test(t) || /[?&]partner=\d+/i.test(t);
}

export function normalizeTradeUrl(url: string) {
  return url.trim().slice(0, 400);
}
