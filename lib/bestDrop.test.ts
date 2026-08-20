import assert from "node:assert/strict";
import { test } from "node:test";
import { bestDropStatusLabel, ownedBestDropItem } from "./bestDrop";
import type { BestDrop, InventoryItem } from "./types";

const drop: BestDrop = {
  skinId: "kara-ruby",
  wear: "fn",
  instanceId: "drop-ruby",
  snapshot: { name: "Karambit | Doppler (Ruby)", rarity: "gold", weapon: "Knife" },
  valueUsd: 7250,
  obtainedAt: 1,
};

function row(extra: Partial<InventoryItem> = {}): InventoryItem {
  return {
    instanceId: "drop-ruby",
    id: "kara-ruby",
    name: "Karambit | Doppler (Ruby)",
    weapon: "Knife",
    rarity: "gold",
    wear: "fn",
    price: 7250,
    obtainedAt: 1,
    ...extra,
  } as InventoryItem;
}

test("ownedBestDropItem ignores sold history rows", () => {
  assert.equal(ownedBestDropItem(drop, [row({ leftVia: "sell", soldAt: 2 })]), undefined);
  assert.equal(ownedBestDropItem(drop, [row()]).instanceId, "drop-ruby");
});

test("bestDropStatusLabel follows leftVia, not history presence", () => {
  assert.equal(bestDropStatusLabel(drop, [row()]), "In vault");
  assert.equal(bestDropStatusLabel(drop, [row({ leftVia: "sell", soldAt: 2 })]), "Sold");
  assert.equal(bestDropStatusLabel(drop, [row({ leftVia: "upgrade", soldAt: 2 })]), "Used in upgrade");
  assert.equal(bestDropStatusLabel(drop, []), "Sold");
});
