import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { applyNonceCookie } from "@/lib/auth/session";
import { publicSiteOrigin } from "@/lib/auth/site";
import { STEAM_RETURN_PATH, steamOpenIdBeginUrl } from "@/lib/auth/steam";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = publicSiteOrigin(req);
  const nonce = randomBytes(16).toString("hex");
  const returnTo = `${origin}${STEAM_RETURN_PATH}?n=${nonce}`;
  const res = NextResponse.redirect(steamOpenIdBeginUrl(returnTo, origin));
  applyNonceCookie(res, nonce);
  return res;
}
