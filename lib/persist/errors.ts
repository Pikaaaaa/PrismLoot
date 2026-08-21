import { NextResponse } from "next/server";

export function prismaErrorCode(err: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = err;
  for (let i = 0; i < 4 && current && typeof current === "object" && !seen.has(current); i++) {
    seen.add(current);
    if ("code" in current) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && code) return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Prisma P2003/P2014 — missing Case/Skin rows (empty Neon catalog). */
export function isPrismaFkError(err: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = err;
  for (let i = 0; i < 4 && current && typeof current === "object" && !seen.has(current); i++) {
    seen.add(current);
    const code = prismaErrorCode(current);
    if (code === "P2003" || code === "P2014") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export const PLAY_ERROR_STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  USER_BANNED: 403,
  INSUFFICIENT_BALANCE: 400,
  ITEMS_UNAVAILABLE: 409,
  USER_NOT_FOUND: 404,
  CATALOG_MISSING: 503,
  CATALOG_SKIN_MISSING: 500,
  INVALID_ASSET: 400,
  AMOUNT_TOO_LOW: 400,
  ALREADY_REVIEWED: 409,
  DEPOSIT_NOT_FOUND: 404,
  DEPOSIT_UNAVAILABLE: 503,
  GIFT_CARD_UNAVAILABLE: 503,
  GIFT_CARD_INVALID: 400,
  GIFT_CARD_USED: 409,
  GIFT_CARD_EXPIRED: 410,
  GIFT_CARD_DISABLED: 409,
  WAGER_LOCKED: 403,
  WITHDRAWAL_PENDING: 409,
  WITHDRAWAL_NOT_FOUND: 404,
  WITHDRAWAL_UNAVAILABLE: 503,
  TRADE_URL_REQUIRED: 400,
  TRADE_URL_INVALID: 400,
  EMAIL_INVALID: 400,
  PROMO_INVALID: 400,
  PROMO_NOT_APPLIED: 400,
  TRON_API_FAILED: 503,
  CASE_NOT_FOUND: 404,
  CASE_COUPON_UNAVAILABLE: 503,
  CASE_COUPON_INVALID: 400,
  CASE_COUPON_USED: 409,
  CASE_COUPON_EXPIRED: 410,
  CASE_COUPON_DISABLED: 409,
  CASE_COUPON_EXHAUSTED: 409,
  CASE_COUPON_EXISTS: 409,
};

export const PLAY_ERROR_LABEL: Record<string, string> = {
  AUTH_REQUIRED: "Sign in with Steam to continue.",
  USER_BANNED: "This account is banned.",
  INSUFFICIENT_BALANCE: "Not enough balance.",
  ITEMS_UNAVAILABLE: "That skin is no longer in your inventory.",
  USER_NOT_FOUND: "User not found.",
  CATALOG_MISSING: "Catalog is still syncing. Try opening again.",
  CATALOG_SKIN_MISSING: "That skin is missing from the catalog.",
  INVALID_ASSET: "Choose a valid asset and network.",
  AMOUNT_TOO_LOW: "Amount is below the minimum.",
  ALREADY_REVIEWED: "This request was already reviewed.",
  DEPOSIT_NOT_FOUND: "Deposit not found.",
  DEPOSIT_UNAVAILABLE: "Cashier is still starting up. Try again in a moment.",
  GIFT_CARD_UNAVAILABLE: "Gift cards could not be processed. Try again.",
  GIFT_CARD_INVALID: "That gift card code is not valid.",
  GIFT_CARD_USED: "This gift card was already redeemed.",
  GIFT_CARD_EXPIRED: "This gift card has expired.",
  GIFT_CARD_DISABLED: "This gift card was disabled.",
  WAGER_LOCKED: "Play through the remaining amount in cases, upgrades, or contracts first.",
  WITHDRAWAL_PENDING: "You already have a pending withdrawal. Wait for a decision.",
  WITHDRAWAL_NOT_FOUND: "Withdrawal request not found.",
  WITHDRAWAL_UNAVAILABLE: "Withdrawals are temporarily unavailable. Try again in a moment.",
  TRADE_URL_REQUIRED: "Add your trade URL in profile.",
  TRADE_URL_INVALID: "That does not look like a Steam trade URL. Check it in your profile.",
  EMAIL_INVALID: "That does not look like an email address.",
  PROMO_INVALID: "That promo code is not valid.",
  PROMO_NOT_APPLIED: "Apply the promo code before creating a deposit.",
  INVALID_INPUT: "Check the form and try again.",
  CREATE_FAILED: "Could not create gift cards.",
  DISABLE_FAILED: "Could not disable that card.",
  CASE_NOT_FOUND: "That case is not in the catalog.",
  CASE_COUPON_UNAVAILABLE: "Free-case codes could not be processed. Try again.",
  CASE_COUPON_INVALID: "That free-case code is not valid.",
  CASE_COUPON_USED: "You already redeemed this free-case code.",
  CASE_COUPON_EXPIRED: "This free-case code has expired.",
  CASE_COUPON_DISABLED: "This free-case code was disabled.",
  CASE_COUPON_EXHAUSTED: "This free-case code has no uses left.",
  CASE_COUPON_EXISTS: "That code already exists.",
  CASE_COUPON_CREATE_FAILED: "Could not create free-case codes.",
  CASE_COUPON_DISABLE_FAILED: "Could not disable that code.",
  WITHDRAW_FAILED: "Could not create a withdrawal request.",
};

export function playErrorMessage(err: unknown) {
  if (isPrismaFkError(err)) return "CATALOG_MISSING";
  return err instanceof Error ? err.message : "FAILED";
}

export function humanPlayError(code?: string | null) {
  if (!code) return "Something went wrong. Try again.";
  return PLAY_ERROR_LABEL[code] ?? (code.includes("_") ? "Something went wrong. Try again." : code);
}

export function jsonPlayError(err: unknown, fallback = "FAILED") {
  const raw = playErrorMessage(err);
  const known = raw in PLAY_ERROR_STATUS || raw in PLAY_ERROR_LABEL;
  const error = known ? raw : fallback;
  const status = PLAY_ERROR_STATUS[error] ?? (error === fallback ? 500 : 400);
  if (!known || isPrismaFkError(err) || error === fallback || error === "GIFT_CARD_UNAVAILABLE") {
    console.error(`[play] ${fallback}`, {
      error,
      prismaCode: prismaErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
      err,
    });
  }
  return NextResponse.json({ ok: false, error, message: humanPlayError(error) }, { status });
}
