import { NextResponse } from "next/server";
import { DISCONNECTED_STEAM, steamOpenIdBeginUrl } from "@/lib/auth/steam";

/**
 * Steam OpenID start. Unconnected in this demo: never forwards a password,
 * never stores Steam credentials. A live deploy would 302 to Steam here.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const beginUrl = steamOpenIdBeginUrl(`${origin}/api/auth/steam/callback`, origin);
  return NextResponse.json({
    ok: false,
    demo: true,
    connected: false,
    identity: DISCONNECTED_STEAM,
    message: "Steam OpenID is not connected. Identity only — never send a Steam password to PrismLoot.",
    beginUrl,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      demo: true,
      connected: false,
      identity: DISCONNECTED_STEAM,
      error: "STEAM_NOT_CONNECTED",
    },
    { status: 501 },
  );
}
