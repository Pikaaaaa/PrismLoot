import { CURRENT_USER } from "@/lib/mock-data";
import type { PublicUser } from "@/lib/types";

/**
 * Demo identity only. Case odds never use this object.
 * Auth today is login+password. Steam OpenID is stubbed (see lib/auth/steam.ts).
 */
export function getDemoUser(): PublicUser {
  return CURRENT_USER;
}
