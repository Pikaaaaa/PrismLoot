/** Alphabet skips 0/O/I/1 so codes stay readable. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const GIFT_CODE_PATTERN = /^PL-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

function chunk() {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!;
  }
  return out;
}

/** Format: PL-XXXX-XXXX-XXXX */
export function generateGiftCode() {
  return `PL-${chunk()}-${chunk()}-${chunk()}`;
}

export function normalizeGiftCode(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("PL") && compact.length === 14) {
    return `PL-${compact.slice(2, 6)}-${compact.slice(6, 10)}-${compact.slice(10, 14)}`;
  }
  const dashed = raw.toUpperCase().replace(/\s+/g, "");
  return dashed;
}

export function isGiftCodeFormat(code: string) {
  return GIFT_CODE_PATTERN.test(code);
}
