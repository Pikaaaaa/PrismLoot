import { NextResponse } from "next/server";
import { applySessionCookie, clearNonceCookie, readSteamNonce } from "@/lib/auth/session";
import { publicSiteOrigin } from "@/lib/auth/site";
import { STEAM_RETURN_PATH } from "@/lib/auth/steam";
import { fetchSteamPersona, upsertSteamUser, verifySteamAssertion } from "@/lib/auth/steam-server";

export const dynamic = "force-dynamic";

function homeRedirect(origin: string, auth: "ok" | "error" | "cancel") {
  return NextResponse.redirect(new URL(`/?auth=${auth}`, origin));
}

export async function GET(req: Request) {
  const origin = publicSiteOrigin(req);
  const url = new URL(req.url);
  try {
    const mode = url.searchParams.get("openid.mode");
    if (mode === "cancel") {
      const cancelled = homeRedirect(origin, "cancel");
      clearNonceCookie(cancelled);
      return cancelled;
    }

    const nonce = url.searchParams.get("n");
    const expected = await readSteamNonce();
    if (!nonce || !expected || nonce !== expected) {
      const denied = homeRedirect(origin, "error");
      clearNonceCookie(denied);
      return denied;
    }

    const expectedReturnTo = `${origin}${STEAM_RETURN_PATH}?n=${nonce}`;
    const steamId = await verifySteamAssertion(url, expectedReturnTo);
    const persona = await fetchSteamPersona(steamId);
    const user = await upsertSteamUser({
      steamId,
      displayName: persona.personaName,
      avatarUrl: persona.avatarUrl,
    });

    const res = homeRedirect(origin, "ok");
    applySessionCookie(res, user.id);
    clearNonceCookie(res);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OPENID_FAILED";
    if (message !== "OPENID_CANCELLED") console.error("[steam] return failed", err);
    const res = homeRedirect(origin, message === "OPENID_CANCELLED" ? "cancel" : "error");
    clearNonceCookie(res);
    return res;
  }
}
