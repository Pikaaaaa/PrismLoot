import { getCatalogItem } from "@/lib/itemCatalog";
import { prisma, usd } from "@/lib/db";
import type { HistoryEntry } from "@/lib/types";

const LEDGER_KIND: Record<string, HistoryEntry["kind"] | null> = {
  CASE_OPEN: "open",
  SELL: "sell",
  UPGRADE: "upgrade",
  CONTRACT: "contract",
  DEPOSIT: "deposit",
  GIFT: "deposit",
  WITHDRAW: "withdraw",
  WITHDRAW_REFUND: "withdraw",
  PROMO: null,
  ADMIN_GRANT: null,
  ADMIN_ADJUST: null,
};

export type PlayerActivity = {
  history: HistoryEntry[];
  wageredUsd: number;
  upgradesWon: number;
  upgradesLost: number;
};

function parseMeta(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function skinName(id: string | null | undefined, fallback: string) {
  if (!id) return fallback;
  return getCatalogItem(id)?.name ?? fallback;
}

function historyFromLedgerRow(row: {
  id: string;
  kind: string;
  amountUsd: number;
  note: string;
  meta: string;
  createdAt: Date;
}): HistoryEntry | null {
  const kind = LEDGER_KIND[row.kind];
  if (!kind) return null;
  const meta = parseMeta(row.meta);
  const success = meta.success;
  const result =
    typeof success === "boolean" ? (success ? "success" : "fail") : undefined;
  const title =
    row.kind === "UPGRADE"
      ? success
        ? "Upgrade success"
        : "Upgrade failed"
      : row.kind === "GIFT"
        ? "Gift card"
        : row.kind === "WITHDRAW" || row.kind === "WITHDRAW_REFUND"
          ? "Withdrawal"
          : row.kind === "SELL"
            ? "Sold items"
            : row.note || row.kind.replaceAll("_", " ");
  return {
    id: row.id,
    kind,
    title,
    detail: row.note,
    amount: usd(row.amountUsd),
    at: row.createdAt.getTime(),
    result,
    chance: typeof meta.chance === "number" ? meta.chance : undefined,
    itemName: typeof meta.resultSkinId === "string" ? skinName(meta.resultSkinId, "") || undefined : undefined,
    targetName: typeof meta.targetSkinId === "string" ? skinName(meta.targetSkinId, "") || undefined : undefined,
  };
}

async function historyFromAttempts(userId: string): Promise<HistoryEntry[]> {
  const [opens, upgrades, contracts] = await Promise.all([
    prisma.caseOpen.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { case: true, skin: true },
    }),
    prisma.upgradeAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.contractAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const rows: HistoryEntry[] = [];
  for (const row of opens) {
    rows.push({
      id: row.id,
      kind: "open",
      title: `Opened ${row.case.name}`,
      detail: row.skin.name,
      amount: usd(-row.costUsd),
      at: row.createdAt.getTime(),
      itemName: row.skin.name,
    });
  }
  for (const row of upgrades) {
    rows.push({
      id: row.id,
      kind: "upgrade",
      title: row.success ? "Upgrade success" : "Upgrade failed",
      detail: skinName(row.targetSkinId, "Upgrade"),
      amount: usd(row.success ? 0 : -row.extraUsd),
      at: row.createdAt.getTime(),
      chance: row.chance,
      result: row.success ? "success" : "fail",
      targetName: skinName(row.targetSkinId, ""),
    });
  }
  for (const row of contracts) {
    const name = skinName(row.resultSkinId, "Contract");
    rows.push({
      id: row.id,
      kind: "contract",
      title: "Contract",
      detail: name,
      amount: 0,
      at: row.createdAt.getTime(),
      itemName: name,
    });
  }
  return rows.sort((a, b) => b.at - a.at).slice(0, 12);
}

/** Live ops + cash wagered from the DB — not the session-only demo log. */
export async function loadPlayerActivity(userId: string): Promise<PlayerActivity> {
  const empty: PlayerActivity = { history: [], wageredUsd: 0, upgradesWon: 0, upgradesLost: 0 };
  try {
    const [ledger, caseSpend, upgradesWon, upgradesLost, extraSpend] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.caseOpen.aggregate({
        where: { userId },
        _sum: { costUsd: true },
      }),
      prisma.upgradeAttempt.count({ where: { userId, success: true } }),
      prisma.upgradeAttempt.count({ where: { userId, success: false } }),
      prisma.upgradeAttempt.aggregate({
        where: { userId },
        _sum: { extraUsd: true },
      }),
    ]);

    const wageredUsd = usd((caseSpend._sum.costUsd ?? 0) + (extraSpend._sum.extraUsd ?? 0));
    let history = ledger
      .map(historyFromLedgerRow)
      .filter((entry): entry is HistoryEntry => entry != null);
    if (!history.length) {
      try {
        history = await historyFromAttempts(userId);
      } catch (err) {
        console.error("[me] attempt history fallback failed", err);
      }
    }

    return { history, wageredUsd, upgradesWon, upgradesLost };
  } catch (err) {
    console.error("[me] activity failed", err);
    return empty;
  }
}
