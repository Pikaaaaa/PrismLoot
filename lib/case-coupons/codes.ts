/** Alphabet skips 0/O/I/1 so generated codes stay readable. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CASE_COUPON_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/;

function chunk(len = 4) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!;
  }
  return out;
}

/** Format: FC-XXXX-XXXX */
export function generateCaseCouponCode() {
  return `FC-${chunk()}-${chunk()}`;
}

export function normalizeCaseCouponCode(raw: string) {
  return raw.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "");
}

export function isCaseCouponFormat(code: string) {
  return CASE_COUPON_PATTERN.test(code);
}
