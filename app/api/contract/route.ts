import { NextResponse } from "next/server";
import { resolveContract } from "@/lib/engine/contract";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistContractAttempt } from "@/lib/persist/game";

function idsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((id) => String(id ?? "").trim()).filter(Boolean);
}

function extraOf(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return +n.toFixed(2);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { skinIds?: unknown; instanceIds?: unknown; extraStake?: unknown };
    const skinIds = idsOf(body.skinIds);
    const instanceIds = idsOf(body.instanceIds);
    const extraStake = extraOf(body.extraStake);
    const result = resolveContract(skinIds, extraStake);
    if (instanceIds.length) {
      if (instanceIds.length !== skinIds.length) {
        return NextResponse.json({ ok: false, error: "SOURCE_MISMATCH" }, { status: 400 });
      }
      await persistContractAttempt({
        sourceInstanceIds: instanceIds,
        extraUsd: extraStake,
        item: result.item,
      });
    }
    return NextResponse.json({
      ok: true,
      item: result.item,
      inputValue: result.inputValue,
      rewardValue: result.rewardValue,
      profit: result.profit,
      ev: result.ev,
      rtp: result.rtp,
      minReward: result.minReward,
      maxReward: result.maxReward,
      extraStake,
    });
  } catch (err) {
    return jsonPlayError(err, "CONTRACT_FAILED");
  }
}
