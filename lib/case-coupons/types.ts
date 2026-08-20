export type SerializedCaseCoupon = {
  id: string;
  code: string;
  caseId: string;
  caseName: string;
  maxUses: number;
  remaining: number;
  usedCount: number;
  opensPerRedeem: number;
  expiresAt: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  note: string;
};

export type FreeCaseClaimSummary = {
  caseId: string;
  caseName: string;
  remaining: number;
};

export type CaseCouponRedeemResult = {
  code: string;
  caseId: string;
  caseName: string;
  opens: number;
  claim: FreeCaseClaimSummary;
};
