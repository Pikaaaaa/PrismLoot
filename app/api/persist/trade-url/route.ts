import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistTradeUrl } from "@/lib/persist/game";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url : "";
    const result = await persistTradeUrl({ userId, url });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonPlayError(err, "PERSIST_FAILED");
  }
}
