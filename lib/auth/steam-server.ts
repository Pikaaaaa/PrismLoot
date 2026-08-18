import { prisma } from "@/lib/db";
import { parseSteamId64, STEAM_OPENID_PROVIDER } from "@/lib/auth/steam";

export type SteamPersona = {
  personaName: string;
  avatarUrl: string;
};

function fallbackName(steamId64: string) {
  return `Steam ${steamId64.slice(-4)}`;
}

export async function verifySteamAssertion(url: URL, expectedReturnTo: string): Promise<string> {
  const mode = url.searchParams.get("openid.mode");
  if (mode === "cancel") throw new Error("OPENID_CANCELLED");
  if (mode !== "id_res") throw new Error("OPENID_MODE");

  const claimed = url.searchParams.get("openid.claimed_id") || url.searchParams.get("openid.identity");
  const steamId = parseSteamId64(claimed);
  if (!steamId) throw new Error("OPENID_STEAM_ID");

  const returnTo = url.searchParams.get("openid.return_to") ?? "";
  const expected = new URL(expectedReturnTo);
  let actual: URL;
  try {
    actual = new URL(returnTo);
  } catch {
    throw new Error("OPENID_RETURN_TO");
  }
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) {
    throw new Error("OPENID_RETURN_TO");
  }

  const body = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");

  const res = await fetch(STEAM_OPENID_PROVIDER, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!/is_valid\s*:\s*true/i.test(text)) throw new Error("OPENID_INVALID");
  return steamId;
}

export async function fetchSteamPersona(steamId64: string): Promise<SteamPersona> {
  const key = process.env.STEAM_API_KEY?.trim();
  if (!key) {
    return { personaName: fallbackName(steamId64), avatarUrl: "" };
  }
  try {
    const endpoint = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    endpoint.searchParams.set("key", key);
    endpoint.searchParams.set("steamids", steamId64);
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) return { personaName: fallbackName(steamId64), avatarUrl: "" };
    const data = (await res.json()) as {
      response?: {
        players?: Array<{ personaname?: string; avatarfull?: string; avatarmedium?: string }>;
      };
    };
    const player = data.response?.players?.[0];
    const personaName = player?.personaname?.trim() || fallbackName(steamId64);
    const avatarUrl = player?.avatarfull?.trim() || player?.avatarmedium?.trim() || "";
    return { personaName: personaName.slice(0, 64), avatarUrl: avatarUrl.slice(0, 400) };
  } catch (err) {
    console.warn("[steam] persona fetch failed", err);
    return { personaName: fallbackName(steamId64), avatarUrl: "" };
  }
}

export async function upsertSteamUser(input: { steamId: string; displayName: string; avatarUrl: string }) {
  const steamId = input.steamId;
  const displayName = input.displayName.trim().slice(0, 64) || fallbackName(steamId);
  const avatarUrl = input.avatarUrl.trim().slice(0, 400);
  const existing = await prisma.user.findUnique({ where: { steamId } });
  if (existing) {
    try {
      return await prisma.user.update({
        where: { id: existing.id },
        data: { displayName, avatarUrl },
      });
    } catch (err) {
      console.warn("[steam] avatarUrl update skipped", err);
      return prisma.user.update({
        where: { id: existing.id },
        data: { displayName },
      });
    }
  }

  const id = `steam_${steamId}`;
  try {
    return await prisma.user.create({
      data: {
        id,
        steamId,
        displayName,
        avatarUrl,
        balanceUsd: 0,
        role: "USER",
      },
    });
  } catch (err) {
    const raced = await prisma.user.findUnique({ where: { steamId } });
    if (raced) return raced;
    try {
      return await prisma.user.create({
        data: {
          id,
          steamId,
          displayName,
          balanceUsd: 0,
          role: "USER",
        },
      });
    } catch (inner) {
      const again = await prisma.user.findUnique({ where: { steamId } });
      if (again) return again;
      throw inner ?? err;
    }
  }
}
