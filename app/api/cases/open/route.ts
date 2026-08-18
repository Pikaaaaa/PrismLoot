import { NextResponse } from "next/server";
import { getCaseOverlay } from "@/lib/catalog";
import { jsonPlayError } from "@/lib/persist/errors";
import { persistCaseOpens } from "@/lib/persist/game";
import { openCases } from "@/lib/services/caseService";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { caseId?: string; count?: unknown };
    const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "caseId required" }, { status: 400 });
    }
    const overlay = await getCaseOverlay(caseId);
    if (overlay && !overlay.enabled) {
      return NextResponse.json({ ok: false, error: "CASE_DISABLED" }, { status: 403 });
    }
    const countRaw = Number(body.count);
    const count = Number.isFinite(countRaw) ? countRaw : 1;
    const result = openCases(caseId, count);
    const charged = overlay ? +(overlay.priceUsd * result.items.length).toFixed(2) : result.charged;
    await persistCaseOpens({ caseId, costUsd: charged, items: result.items });
    return NextResponse.json({
      ok: true,
      caseId,
      count: result.items.length,
      charged,
      items: result.items,
      item: result.items[0],
      rolls: result.rolls,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OPEN_FAILED";
    if (message === "CASE_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }
    return jsonPlayError(err, "OPEN_FAILED");
  }
}
