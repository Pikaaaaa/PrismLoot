import { NextResponse } from "next/server";
import { publicUserFromAccount } from "@/lib/auth/account";
import { getSessionUserId } from "@/lib/auth/session";
import { DISCONNECTED_STEAM, steamIdentityFromUser } from "@/lib/auth/steam";
import { loadPlayerSnapshot } from "@/lib/persist/game";

export const dynamic = "force-dynamic";

const GUEST = {
  ok: true as const,
  guest: true as const,
  user: null,
  steam: DISCONNECTED_STEAM,
  balance: 0,
  wagerRemainingUsd: 0,
  tradeUrl: "",
  banned: false,
  inventory: [] as [],
  bestDrop: null,
  stats: { openedCases: 0, upgrades: 0, contracts: 0 },
};

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json(GUEST);

    const snapshot = await loadPlayerSnapshot(userId);
    const user = publicUserFromAccount({
      id: snapshot.user.id,
      displayName: snapshot.user.displayName,
      steamId: snapshot.user.steamId,
      avatarUrl: snapshot.user.avatarUrl,
    });
    return NextResponse.json({
      ok: true,
      guest: false,
      user,
      steam: steamIdentityFromUser(snapshot.user),
      balance: snapshot.balance,
      wagerRemainingUsd: snapshot.wagerRemainingUsd,
      tradeUrl: snapshot.tradeUrl,
      banned: snapshot.banned,
      inventory: snapshot.inventory,
      bestDrop: snapshot.bestDrop,
      stats: snapshot.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ME_FAILED";
    if (message === "USER_NOT_FOUND" || message === "AUTH_REQUIRED") {
      return NextResponse.json(GUEST);
    }
    console.error("[me] snapshot failed", err);
    return NextResponse.json({ ok: false, error: "ME_FAILED" }, { status: 500 });
  }
}
