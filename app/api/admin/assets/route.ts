import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { validateCaseAssets } from "@/lib/validate-case-assets";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const report = validateCaseAssets();
  return NextResponse.json(report);
}
