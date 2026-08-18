import { NextResponse } from "next/server";
import { listCases } from "@/lib/services/caseService";

export async function GET() {
  const cases = listCases().map((crate) => ({
    id: crate.id,
    name: crate.name,
    price: crate.price,
    featuredReward: crate.featuredReward,
    rewards: crate.rewards,
  }));
  return NextResponse.json({ ok: true, cases });
}
