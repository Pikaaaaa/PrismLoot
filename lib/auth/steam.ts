/**
 * Steam OpenID architecture (identity only).
 *
 * Real flow (when connected):
 * 1. Browser hits GET /api/auth/steam → 302 to steamcommunity.com/openid/login
 * 2. Steam returns to /api/auth/steam/callback with an OpenID assertion
 * 3. Server verifies the assertion, stores steamId64 + persona — never a password
 *
 * This demo does **not** talk to Steam. The button is labeled DEMO / not connected.
 * Never collect or persist Steam account passwords.
 */

export const STEAM_OPENID_PROVIDER = "https://steamcommunity.com/openid/login";

export type SteamLinkStatus = "not_connected" | "demo";

export type SteamIdentity = {
  connected: boolean;
  status: SteamLinkStatus;
  steamId: string | null;
  personaName: string | null;
  provider: "steam-openid";
};

export const DISCONNECTED_STEAM: SteamIdentity = {
  connected: false,
  status: "not_connected",
  steamId: null,
  personaName: null,
  provider: "steam-openid",
};

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
  const match = claimedId.match(/\/openid\/id\/(\d{17})$/);
  return match?.[1] ?? null;
}
