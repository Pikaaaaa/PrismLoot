import { NextResponse } from "next/server";
import { publicSiteOrigin } from "@/lib/auth/site";
import { STEAM_RETURN_PATH } from "@/lib/auth/steam";

export const dynamic = "force-dynamic";

/** Older bookmark: Steam return lives at /api/auth/steam/return. */
export async function GET(req: Request) {
  const origin = publicSiteOrigin(req);
  const incoming = new URL(req.url);
  const dest = new URL(`${origin}${STEAM_RETURN_PATH}`);
  incoming.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
  return NextResponse.redirect(dest);
}
