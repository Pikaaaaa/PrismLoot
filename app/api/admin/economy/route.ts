import { NextResponse } from "next/server";
import { CASES } from "@/data/cases";
import { requireAdmin } from "@/lib/admin/auth";
import { calculateCaseEV } from "@/lib/economy";
import { getAllCaseStats, getCaseStats } from "@/lib/server/runtime";
import { RTP_PRESETS } from "@/lib/economy/rtp";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const live = getAllCaseStats();
  const rows = CASES.map((crate) => {
    const stats = getCaseStats(crate.id);
    const theoreticalEV = calculateCaseEV(crate);
    const theoreticalRtp = crate.rtp;
    const actualRtp = stats.revenue > 0 ? stats.payout / stats.revenue : 0;
    return {
      id: crate.id,
      name: crate.name,
      price: crate.price,
      preset: RTP_PRESETS[crate.rtpPreset].label,
      rtp: crate.rtp,
      houseEdge: crate.houseEdge,
      theoreticalEV,
      theoreticalRtp,
      opens: stats.opens,
      revenue: stats.revenue,
      payout: stats.payout,
      profit: stats.revenue - stats.payout,
      actualRtp,
    };
  });
  return NextResponse.json({ ok: true, presets: RTP_PRESETS, rows, liveCount: live.length });
}
