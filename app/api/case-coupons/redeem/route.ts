import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/admin/audit";
import { requireUserId } from "@/lib/auth/session";
import { ensureCaseCouponSchema } from "@/lib/case-coupons/ensure";
import { redeemCaseCoupon } from "@/lib/case-coupons/store";
import { jsonPlayError } from "@/lib/persist/errors";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code : "";
    await ensureCaseCouponSchema();
    const result = await redeemCaseCoupon({ code, userId });
    await writeAudit({
      action: "redeem_case_coupon",
      targetType: "case_coupon",
      targetId: result.caseId,
      detail: `${result.code} · ${result.caseName} ×${result.opens}`,
      actorId: userId,
    }).catch((err) => {
      console.error("[case-coupons] redeem audit failed", err);
    });
    return NextResponse.json({
      ok: true,
      code: result.code,
      caseId: result.caseId,
      caseName: result.caseName,
      opens: result.opens,
      claim: result.claim,
    });
  } catch (err) {
    return jsonPlayError(err, "CASE_COUPON_INVALID");
  }
}
