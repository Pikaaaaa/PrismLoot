import assert from "node:assert/strict";
import { test } from "node:test";
import { canSellDrop, isInVault, ownedDrops, vaultStatusLabel } from "./inventoryOwnership";

test("canSellDrop is true only while the instance is still in inventory", () => {
  const inventory = [{ instanceId: "drop-1" }, { instanceId: "drop-2" }];
  assert.equal(canSellDrop("drop-1", inventory), true);
  assert.equal(canSellDrop("drop-2", inventory), true);
  assert.equal(canSellDrop("drop-1", inventory.filter((row) => row.instanceId !== "drop-1")), false);
  assert.equal(canSellDrop("missing", inventory), false);
  assert.equal(canSellDrop(undefined, inventory), false);
  assert.equal(canSellDrop("drop-1", [{ instanceId: "drop-1", withdrawPending: true }]), false);
  assert.equal(canSellDrop("drop-1", [{ instanceId: "drop-1", leftVia: "sell", soldAt: 1 }]), false);
  assert.equal(canSellDrop("drop-1", [{ instanceId: "drop-1", leftVia: "upgrade", soldAt: 1 }]), false);
});

test("ownedDrops drops rolls that were sold, upgraded, or contracted", () => {
  const pending = [{ instanceId: "drop-1" }, { instanceId: "drop-2" }, { instanceId: "drop-3" }];
  const inventory = [{ instanceId: "drop-2" }, { instanceId: "drop-1", leftVia: "sell" as const, soldAt: 1 }];
  assert.deepEqual(ownedDrops(pending, inventory), [{ instanceId: "drop-2" }]);
  assert.deepEqual(ownedDrops(pending, []), []);
});

test("isInVault is false after sell, upgrade, contract, or pending withdraw", () => {
  assert.equal(isInVault({}), true);
  assert.equal(isInVault({ leftVia: "sell", soldAt: 1 }), false);
  assert.equal(isInVault({ leftVia: "upgrade" }), false);
  assert.equal(isInVault({ withdrawPending: true }), false);
  assert.equal(vaultStatusLabel({ leftVia: "sell" }), "Sold");
  assert.equal(vaultStatusLabel({ leftVia: "upgrade" }), "Used in upgrade");
  assert.equal(vaultStatusLabel({ leftVia: "contract" }), "Used in contract");
  assert.equal(vaultStatusLabel({ leftVia: "withdraw" }), "Withdrawn to Steam");
  assert.equal(vaultStatusLabel({ leftVia: "withdraw", withdrawPending: true }), null);
});
