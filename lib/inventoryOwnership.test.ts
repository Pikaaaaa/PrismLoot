import assert from "node:assert/strict";
import { test } from "node:test";
import { canSellDrop, ownedDrops } from "./inventoryOwnership";

test("canSellDrop is true only while the instance is still in inventory", () => {
  const inventory = [{ instanceId: "drop-1" }, { instanceId: "drop-2" }];
  assert.equal(canSellDrop("drop-1", inventory), true);
  assert.equal(canSellDrop("drop-2", inventory), true);
  assert.equal(canSellDrop("drop-1", inventory.filter((row) => row.instanceId !== "drop-1")), false);
  assert.equal(canSellDrop("missing", inventory), false);
  assert.equal(canSellDrop(undefined, inventory), false);
  assert.equal(canSellDrop("drop-1", [{ instanceId: "drop-1", withdrawPending: true }]), false);
});

test("ownedDrops drops rolls that were sold, upgraded, or contracted", () => {
  const pending = [{ instanceId: "drop-1" }, { instanceId: "drop-2" }, { instanceId: "drop-3" }];
  const inventory = [{ instanceId: "drop-2" }];
  assert.deepEqual(ownedDrops(pending, inventory), [{ instanceId: "drop-2" }]);
  assert.deepEqual(ownedDrops(pending, []), []);
});
