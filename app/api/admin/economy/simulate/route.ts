import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { simulateCase } from "@/lib/services/caseService";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = (await req.json()) as { caseId?: string; n?: number };
    const caseId = typeof body.caseId === "string" ? body.caseId : "";
    const n = Number(body.n);
    if (!caseId) return NextResponse.json({ ok: false, error: "caseId required" }, { status: 400 });
    if (![10, 100, 1000, 10_000, 100_000].includes(n)) {
      return NextResponse.json({ ok: false, error: "n must be 10, 100, 1000, 10000, or 100000" }, { status: 400 });
    }
    const result = simulateCase(caseId, n);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SIM_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
