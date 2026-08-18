/** Case-open sell/keep must follow live vault membership, never a stale roll copy. */

export function isWithdrawPending(item: { withdrawPending?: boolean }) {
  return Boolean(item.withdrawPending);
}

export function canSellDrop(
  instanceId: string | undefined,
  inventory: ReadonlyArray<{ instanceId: string; withdrawPending?: boolean }>,
): boolean {
  if (!instanceId) return false;
  return inventory.some((item) => item.instanceId === instanceId && !item.withdrawPending);
}

export function ownedDrops<T extends { instanceId: string }>(
  drops: ReadonlyArray<T>,
  inventory: ReadonlyArray<{ instanceId: string }>,
): T[] {
  const have = new Set(inventory.map((item) => item.instanceId));
  return drops.filter((drop) => have.has(drop.instanceId));
}
