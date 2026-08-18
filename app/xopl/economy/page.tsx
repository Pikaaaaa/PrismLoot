import { EconomyLab } from "@/components/admin/EconomyLab";
import { CASES } from "@/data/cases";
import { calculateCaseEV } from "@/lib/economy";
import { getAllCaseStats, getCaseStats } from "@/lib/server/runtime";
import { RTP_PRESETS } from "@/lib/economy/rtp";

export default function EconomyAdminPage() {
  const live = getAllCaseStats();
  const rows = CASES.map((crate) => {
    const stats = getCaseStats(crate.id);
    const theoreticalEV = calculateCaseEV(crate);
    return {
      id: crate.id,
      name: crate.name,
      price: crate.price,
      preset: RTP_PRESETS[crate.rtpPreset].label,
      rtp: crate.rtp,
      houseEdge: crate.houseEdge,
      theoreticalEV,
      theoreticalRtp: crate.rtp,
      opens: stats.opens,
      revenue: stats.revenue,
      payout: stats.payout,
      profit: stats.revenue - stats.payout,
      actualRtp: stats.revenue > 0 ? stats.payout / stats.revenue : 0,
    };
  });

  return <EconomyLab rows={rows} liveCount={live.length} />;
}
