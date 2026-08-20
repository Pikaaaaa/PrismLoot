import type { InventoryLeftVia } from "@/lib/types";

/** Case-open sell/keep must follow live vault membership, never a stale roll copy. */

export function isWithdrawPending(item: { withdrawPending?: boolean }) {
  return Boolean(item.withdrawPending);
}

export function isInVault(item: {
  leftVia?: InventoryLeftVia | null;
  soldAt?: number | null;
  withdrawPending?: boolean;
}) {
  return !item.leftVia && !item.soldAt && !item.withdrawPending;
}

export function vaultStatusLabel(item: {
  leftVia?: InventoryLeftVia | null;
  withdrawPending?: boolean;
}): string | null {
  if (item.withdrawPending) return null;
  switch (item.leftVia) {
    case "sell":
      return "Sold";
    case "upgrade":
      return "Used in upgrade";
    case "contract":
      return "Used in contract";
    case "withdraw":
      return "Withdrawn to Steam";
    default:
      return null;
  }
}

export function canSellDrop(
  instanceId: string | undefined,
  inventory: ReadonlyArray<{
    instanceId: string;
    withdrawPending?: boolean;
    leftVia?: InventoryLeftVia | null;
    soldAt?: number | null;
  }>,
): boolean {
  if (!instanceId) return false;
  return inventory.some((item) => item.instanceId === instanceId && isInVault(item));
}

export function ownedDrops<T extends { instanceId: string }>(
  drops: ReadonlyArray<T>,
  inventory: ReadonlyArray<{
    instanceId: string;
    withdrawPending?: boolean;
    leftVia?: InventoryLeftVia | null;
    soldAt?: number | null;
  }>,
): T[] {
  const have = new Set(inventory.filter(isInVault).map((item) => item.instanceId));
  return drops.filter((drop) => have.has(drop.instanceId));
}
