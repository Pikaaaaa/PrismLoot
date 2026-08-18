/**
 * Catalog split:
 * - DB (`Skin`, `Case`) is the admin source of truth for priceUsd + enabled.
 * - Live rolls and the case-page odds grid both read `data/cases.ts` weights
 *   (`crate.rewards` → rewardEngine / CaseRewardGrid). Do not overlay stale
 *   CaseReward rows onto opens — re-seed so SQLite matches the published table.
 * - Server routes overlay DB price/enabled via `getCaseOverlay` before charging.
 */
import { prisma } from "@/lib/db";

export async function getCaseOverlay(caseId: string) {
  try {
    return await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, priceUsd: true, enabled: true, name: true },
    });
  } catch {
    return null;
  }
}

export async function getSkinOverlay(skinId: string) {
  try {
    return await prisma.skin.findUnique({
      where: { id: skinId },
      select: { id: true, priceUsd: true, enabled: true, name: true },
    });
  } catch {
    return null;
  }
}
