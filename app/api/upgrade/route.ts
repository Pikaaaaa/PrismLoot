import { NextResponse } from "next/server";
import { UPGRADE_MAX_CHANCE } from "@/lib/economy/config";
import { previewUpgrade, resolveUpgrade } from "@/lib/engine/upgrade";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistUpgradeAttempt } from "@/lib/persist/game";
import type { Wear } from "@/lib/types";

const WEARS: Wear[] = ["fn", "mw", "ft", "ww", "bs"];

function idsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((id) => String(id ?? "").trim()).filter(Boolean);
}

function extraOf(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return +n.toFixed(2);
}

function wearsOf(value: unknown, count: number): Wear[] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  if (value.length !== count) return undefined;
  const wears: Wear[] = [];
  for (const raw of value) {
    const wear = String(raw ?? "").trim() as Wear;
    if (!WEARS.includes(wear)) return undefined;
    wears.push(wear);
  }
  return wears;
}

function wearOf(value: unknown): Wear | undefined {
  const wear = String(value ?? "").trim() as Wear;
  return WEARS.includes(wear) ? wear : undefined;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sourceInstanceIds?: unknown;
      sourceSkinIds?: unknown;
      sourceSkinId?: string;
      sourceWears?: unknown;
      targetSkinId?: string;
      targetItemId?: string;
      targetWear?: unknown;
      requestedChance?: number;
      extraStake?: unknown;
    };
    const sourceInstanceIds = idsOf(body.sourceInstanceIds);
    const sourceSkinIds = idsOf(body.sourceSkinIds);
    const fallback = body.sourceSkinId?.trim();
    const skins = sourceSkinIds.length ? sourceSkinIds : fallback ? [fallback] : [];
    const targetSkinId = (body.targetSkinId || body.targetItemId)?.trim();
    const requestedChance = Number(body.requestedChance);
    const extraStake = extraOf(body.extraStake);
    const sourceWears = wearsOf(body.sourceWears, skins.length);
    const targetWear = wearOf(body.targetWear);
    if (!skins.length || !targetSkinId || !Number.isFinite(requestedChance)) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    if (sourceInstanceIds.length && sourceInstanceIds.length !== skins.length) {
      return NextResponse.json({ ok: false, error: "SOURCE_MISMATCH" }, { status: 400 });
    }
    if (Array.isArray(body.sourceWears) && body.sourceWears.length && !sourceWears) {
      return NextResponse.json({ ok: false, error: "SOURCE_MISMATCH" }, { status: 400 });
    }
    if (requestedChance > UPGRADE_MAX_CHANCE + 0.009) {
      return NextResponse.json({ ok: false, error: "CHANCE_TOO_HIGH" }, { status: 400 });
    }
    const preview = previewUpgrade(skins, targetSkinId, extraStake, sourceWears, targetWear);
    if (!(preview.targetValue > preview.inputValue)) {
      return NextResponse.json({ ok: false, error: "DOWNGRADE_BLOCKED" }, { status: 400 });
    }
    if (preview.chance > UPGRADE_MAX_CHANCE + 0.009) {
      return NextResponse.json({ ok: false, error: "CHANCE_TOO_HIGH" }, { status: 400 });
    }
    const result = resolveUpgrade({
      sourceSkinIds: skins,
      targetSkinId,
      requestedChance,
      extraStake,
      sourceWears,
      targetWear,
    });
    if (sourceInstanceIds.length) {
      await persistUpgradeAttempt({
        sourceInstanceIds,
        extraUsd: extraStake,
        chance: result.chance,
        targetSkinId,
        success: result.success,
        item: result.item,
      });
    }
    return NextResponse.json({
      ok: true,
      sourceInstanceIds,
      ...result,
    });
  } catch (err) {
    return jsonPlayError(err, "UPGRADE_FAILED");
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const targetSkinId = url.searchParams.get("targetSkinId")?.trim() ?? "";
    const sourceSkinIds = url.searchParams.getAll("sourceSkinId");
    const extraStake = extraOf(url.searchParams.get("extraStake"));
    const sourceWears = wearsOf(url.searchParams.getAll("sourceWear"), sourceSkinIds.length);
    const targetWear = wearOf(url.searchParams.get("targetWear"));
    const preview = previewUpgrade(sourceSkinIds, targetSkinId, extraStake, sourceWears, targetWear);
    if (!(preview.targetValue > preview.inputValue)) {
      return NextResponse.json({ ok: false, error: "DOWNGRADE_BLOCKED" }, { status: 400 });
    }
    if (preview.chance > UPGRADE_MAX_CHANCE + 0.009) {
      return NextResponse.json({ ok: false, error: "CHANCE_TOO_HIGH" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...preview });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PREVIEW_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
