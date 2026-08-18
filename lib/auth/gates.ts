/** Account / play surfaces. Guests may browse Home and the case catalog. */
export const STEAM_REQUIRED_PREFIXES = [
  "/inventory",
  "/contracts",
  "/upgrade",
  "/deposit",
  "/profile",
  "/history",
  "/settings",
] as const;

export function isSteamRequiredPath(pathname: string) {
  return STEAM_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
