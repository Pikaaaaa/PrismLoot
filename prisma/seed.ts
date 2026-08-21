import { CASES } from "@/data/cases";
import { SKINS } from "@/data/skins";
import { STICKER_SKINS } from "@/data/stickers";
import { STARTING_INVENTORY_IDS } from "@/lib/mock-data";
import { ADMIN_USER_ID, DEMO_USER_ID, prisma, usd } from "@/lib/db";
import type { Skin } from "@/lib/types";

function chunk<T>(rows: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function skinRow(skin: Skin) {
  return {
    id: skin.id,
    weapon: skin.weapon,
    name: skin.name,
    rarity: skin.rarity,
    wear: skin.wear,
    image: skin.image ?? null,
    collection: skin.collection ?? null,
    priceUsd: usd(skin.price),
    enabled: true,
    colors: JSON.stringify(skin.colors ?? []),
    availableWears: JSON.stringify(skin.availableWears ?? []),
  };
}

async function main() {
  const skins = [...SKINS, ...STICKER_SKINS].map(skinRow);

  const existingSkins = await prisma.skin.count();
  if (existingSkins === 0) {
    for (const batch of chunk(skins, 80)) {
      await prisma.skin.createMany({ data: batch });
    }
  } else {
    for (const skin of STICKER_SKINS) {
      await prisma.skin.upsert({
        where: { id: skin.id },
        create: skinRow(skin),
        update: {},
      });
    }
  }

  const skinIds = new Set(skins.map((row) => row.id));

  for (const crate of CASES) {
    await prisma.case.upsert({
      where: { id: crate.id },
      create: {
        id: crate.id,
        name: crate.name,
        description: crate.description,
        priceUsd: usd(crate.price),
        enabled: true,
        rtp: crate.rtp,
        houseEdge: crate.houseEdge,
        rtpPreset: crate.rtpPreset,
        section: crate.section,
        tags: JSON.stringify(crate.tags),
        accent: crate.accent,
        accent2: crate.accent2,
        blurb: crate.blurb,
        image: crate.image ?? null,
        thumbnail: crate.thumbnail ?? null,
        animationType: crate.animationType,
        featuredReward: crate.featuredReward,
        popularity: crate.popularity,
      },
      update: {
        name: crate.name,
        priceUsd: usd(crate.price),
        rtp: crate.rtp,
        houseEdge: crate.houseEdge,
        image: crate.image ?? null,
        thumbnail: crate.thumbnail ?? null,
      },
    });

    const rewards = crate.rewards
      .filter((row) => skinIds.has(row.skinId))
      .map((row) => ({
        caseId: crate.id,
        skinId: row.skinId,
        chance: row.chance,
        weight: row.weight,
        value: usd(row.value),
        rarity: row.rarity,
      }));

    if (rewards.length) {
      await prisma.caseReward.deleteMany({ where: { caseId: crate.id } });
      await prisma.caseReward.createMany({ data: rewards });
    }
  }

  await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    create: {
      id: ADMIN_USER_ID,
      displayName: "Admin",
      role: "ADMIN",
      balanceUsd: 0,
    },
    update: { role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: {
      id: DEMO_USER_ID,
      displayName: "NovaPrime",
      role: "USER",
      balanceUsd: 12500,
    },
    update: { displayName: "NovaPrime" },
  });

  const existingVault = await prisma.inventoryItem.count({ where: { userId: DEMO_USER_ID } });
  if (existingVault === 0) {
    const seeded = STARTING_INVENTORY_IDS.flatMap((row, index) => {
      if (!skinIds.has(row.skinId)) return [];
      return [
        {
          id: `seed_${index}`,
          userId: DEMO_USER_ID,
          skinId: row.skinId,
          wear: row.wear,
          stattrak: row.stattrak,
          source: "PROMO",
          acquiredAt: new Date(1_740_000_000_000 - index * 86_000_000),
        },
      ];
    });
    if (seeded.length) await prisma.inventoryItem.createMany({ data: seeded });

    let best: { id: string; skinId: string; wear: string; priceUsd: number; acquiredAt: Date } | null = null;
    for (const row of seeded) {
      const skin = skins.find((s) => s.id === row.skinId);
      const price = skin?.priceUsd ?? 0;
      if (!best || price > best.priceUsd) {
        best = { id: row.id, skinId: row.skinId, wear: row.wear, priceUsd: price, acquiredAt: row.acquiredAt };
      }
    }
    if (best) {
      const skin = skins.find((s) => s.id === best.skinId);
      if (skin) {
        await prisma.bestDrop.upsert({
          where: { userId: DEMO_USER_ID },
          create: {
            userId: DEMO_USER_ID,
            inventoryItemId: best.id,
            skinId: best.skinId,
            name: skin.name,
            wear: best.wear,
            rarity: skin.rarity,
            weapon: skin.weapon,
            image: skin.image,
            priceUsd: best.priceUsd,
            obtainedAt: best.acquiredAt,
            source: "PROMO",
          },
          update: {},
        });
      }
    }
  }

  await prisma.promoCode.upsert({
    where: { code: "SOLAR-20" },
    create: {
      code: "SOLAR-20",
      percentBonus: 20,
      enabled: true,
      note: "Demo deposit bonus (no live top-up).",
    },
    update: { enabled: true, percentBonus: 20 },
  });

  const [users, skinsN, casesN] = await Promise.all([
    prisma.user.count(),
    prisma.skin.count(),
    prisma.case.count(),
  ]);
  console.log(`Seeded users=${users} skins=${skinsN} cases=${casesN}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
