import { NextResponse } from "next/server";
import { DISCONNECTED_STEAM } from "@/lib/auth/steam";

/** Steam would land here after OpenID. Demo never accepts a password and never completes a link. */
export async function GET() {
  return NextResponse.json({
    ok: false,
    demo: true,
    connected: false,
    identity: DISCONNECTED_STEAM,
    message: "Steam callback is a stub. Sign in with login + password for this demo.",
  });
}
