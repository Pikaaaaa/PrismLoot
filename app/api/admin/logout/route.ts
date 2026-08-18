import { NextResponse } from "next/server";
import { clearAdminSession, requireAdmin } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  await writeAudit({ action: "logout", detail: "Session ended" }).catch(() => undefined);
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
