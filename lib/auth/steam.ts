/**
 * Steam OpenID 2.0 helpers (identity only — never a Steam password).
 *
 * Flow:
 * 1. GET /api/auth/steam → 302 to steamcommunity.com/openid/login
 * 2. Steam returns to GET /api/auth/steam/return
 * 3. Server POSTs the assertion back to Steam (`check_authentication`) and
 *    stores steamId64 + persona on a Prisma User
 */

export const STEAM_OPENID_PROVIDER = "https://steamcommunity.com/openid/login";
export const STEAM_LOGIN_PATH = "/api/auth/steam";
export const STEAM_RETURN_PATH = "/api/auth/steam/return";

export type SteamLinkStatus = "not_connected" | "connected";

export type SteamIdentity = {
  connected: boolean;
  status: SteamLinkStatus;
  steamId: string | null;
  personaName: string | null;
  avatarUrl: string | null;
  provider: "steam-openid";
};

export const DISCONNECTED_STEAM: SteamIdentity = {
  connected: false,
  status: "not_connected",
  steamId: null,
  personaName: null,
  avatarUrl: null,
  provider: "steam-openid",
};

export function steamIdentityFromUser(input: {
  steamId?: string | null;
  displayName: string;
  avatarUrl?: string | null;
}): SteamIdentity {
  const steamId = input.steamId?.trim() || null;
  if (!steamId) return DISCONNECTED_STEAM;
  return {
    connected: true,
    status: "connected",
    steamId,
    personaName: input.displayName,
    avatarUrl: input.avatarUrl?.trim() || null,
    provider: "steam-openid",
  };
}

export function steamOpenIdBeginUrl(returnTo: string, realm: string) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.return_to": returnTo,
    "openid.realm": realm,
  });
  return `${STEAM_OPENID_PROVIDER}?${params.toString()}`;
}

export function parseSteamId64(claimedId: string | null): string | null {
  if (!claimedId) return null;
  const match = claimedId.trim().match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/i);
  return match?.[1] ?? null;
}
