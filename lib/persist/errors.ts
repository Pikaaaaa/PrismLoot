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
};

export const PLAY_ERROR_LABEL: Record<string, string> = {
  AUTH_REQUIRED: "Sign in with Steam to continue.",
  USER_BANNED: "This account is banned.",
  INSUFFICIENT_BALANCE: "Not enough balance.",
  ITEMS_UNAVAILABLE: "Скин больше не в инвентаре.",
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
  WAGER_LOCKED: "Сначала отыграйте оставшуюся сумму в кейсах, апгрейдах или контрактах.",
  WITHDRAWAL_PENDING: "Уже есть заявка на вывод. Дождитесь решения.",
  WITHDRAWAL_NOT_FOUND: "Заявка на вывод не найдена.",
  WITHDRAWAL_UNAVAILABLE: "Вывод временно недоступен. Повторите через секунду.",
  TRADE_URL_REQUIRED: "Укажи трейд-ссылку в профиле",
  TRADE_URL_INVALID: "Это не похоже на трейд-ссылку Steam. Проверь её в профиле.",
  INVALID_INPUT: "Check the form and try again.",
  CREATE_FAILED: "Could not create gift cards.",
  DISABLE_FAILED: "Could not disable that card.",
  WITHDRAW_FAILED: "Не удалось создать заявку на вывод.",
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
