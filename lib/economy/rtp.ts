import type { RtpPreset } from "@/lib/types";
import { CASE_RTP } from "./config";

/**
 * Per-case RTP band: 92–94% (house edge 6–8%).
 * Standard sits on CASE_RTP. Never shown on player case UI.
 */
export const RTP_PRESETS: Record<
  RtpPreset,
  { rtp: number; houseEdge: number; label: string }
> = {
  "low-risk": { rtp: 0.94, houseEdge: 0.06, label: "Low Risk 94%" },
  standard: { rtp: CASE_RTP, houseEdge: +(1 - CASE_RTP).toFixed(4), label: "Standard 93%" },
  "high-risk": { rtp: 0.92, houseEdge: 0.08, label: "High Risk 92%" },
  jackpot: { rtp: 0.92, houseEdge: 0.08, label: "Jackpot 92%" },
};

export function houseEdgeFromRtp(rtp: number) {
  return +(1 - rtp).toFixed(4);
}

/** Published case RTP badge — never prints ≥ 100%. */
export function formatCaseRtp(rtp: number) {
  if (!(rtp > 0) || !(rtp < 1)) {
    throw new Error(`formatCaseRtp: RTP must be below 100% (got ${rtp})`);
  }
  return `${(rtp * 100).toFixed(0)}% RTP`;
}
