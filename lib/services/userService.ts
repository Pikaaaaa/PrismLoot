import type { PublicUser } from "@/lib/types";

/**
 * Live-feed bots only. Real players come from Steam OpenID + Prisma.
 */
export function getDemoUser(user?: PublicUser | null): PublicUser | null {
  return user ?? null;
}
