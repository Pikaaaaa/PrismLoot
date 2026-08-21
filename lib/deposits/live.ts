const PLACEHOLDER_MARKERS = ["DEMO", "XXXX", "PRISMDEMO", "DE00PRISM"];

function hasPlaceholderMarker(value: string) {
  const upper = value.toUpperCase();
  return PLACEHOLDER_MARKERS.some((mark) => upper.includes(mark));
}

/** Live USDT TRC-20 when a real Tron deposit address is configured. */
export function isLiveUsdtTrc20Enabled() {
  if (process.env.DEPOSIT_LIVE_USDT_TRC20 === "0") return false;
  return isValidTronAddress(liveUsdtTrc20Address());
}

export function liveUsdtTrc20Address() {
  return (process.env.DEPOSIT_ADDR_USDT_TRC20 ?? "").trim();
}

export function isValidTronAddress(value: string) {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) return false;
  return !hasPlaceholderMarker(value);
}

/** Live BTC when a real Bitcoin deposit address is configured. */
export function isLiveBtcEnabled() {
  return isValidBtcAddress(liveBtcAddress());
}

export function liveBtcAddress() {
  return (process.env.DEPOSIT_ADDR_BTC ?? "").trim();
}

/** Legacy P2PKH/P2SH (1/3…) or native SegWit bech32 (bc1…). */
export function isValidBtcAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed || hasPlaceholderMarker(trimmed)) return false;
  if (/^bc1[a-z0-9]{25,87}$/i.test(trimmed)) return true;
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) return true;
  return false;
}

/** Live ETH when a real Ethereum deposit address is configured. */
export function isLiveEthEnabled() {
  return isValidEthAddress(liveEthAddress());
}

export function liveEthAddress() {
  return (process.env.DEPOSIT_ADDR_ETH ?? "").trim();
}

/** EVM address: 0x + 40 hex digits. */
export function isValidEthAddress(value: string) {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return false;
  return !hasPlaceholderMarker(trimmed);
}

/** Live SOL when a real Solana deposit address is configured. */
export function isLiveSolEnabled() {
  return isValidSolAddress(liveSolAddress());
}

export function liveSolAddress() {
  return (process.env.DEPOSIT_ADDR_SOL ?? "").trim();
}

/** Solana base58 address, typically 32–44 chars. */
export function isValidSolAddress(value: string) {
  const trimmed = value.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return false;
  return !hasPlaceholderMarker(trimmed);
}

/** Live USDC BEP-20 when a real BSC deposit address is configured. */
export function isLiveUsdcBep20Enabled() {
  return isValidBscAddress(liveUsdcBep20Address());
}

export function liveUsdcBep20Address() {
  return (process.env.DEPOSIT_ADDR_USDC_BEP20 ?? "").trim();
}

/** BSC address: same EVM format as Ethereum (0x + 40 hex digits). */
export function isValidBscAddress(value: string) {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return false;
  return !hasPlaceholderMarker(trimmed);
}

/** Live TRX on TRON when a real Tron deposit address is configured. */
export function isLiveTrxEnabled() {
  return isValidTronAddress(liveTrxAddress());
}

export function liveTrxAddress() {
  return (process.env.DEPOSIT_ADDR_TRX ?? "").trim();
}

/** Live TON when a real TON deposit address is configured. */
export function isLiveTonEnabled() {
  return isValidTonAddress(liveTonAddress());
}

export function liveTonAddress() {
  return (process.env.DEPOSIT_ADDR_TON ?? "").trim();
}

/** TON friendly address: UQ/EQ prefix + 46 base64url chars (~48 total). */
export function isValidTonAddress(value: string) {
  const trimmed = value.trim();
  if (!/^(UQ|EQ)[A-Za-z0-9_-]{46}$/.test(trimmed)) return false;
  return !hasPlaceholderMarker(trimmed);
}

export function isAnyLiveDepositEnabled() {
  return (
    isLiveUsdtTrc20Enabled() ||
    isLiveBtcEnabled() ||
    isLiveEthEnabled() ||
    isLiveSolEnabled() ||
    isLiveUsdcBep20Enabled() ||
    isLiveTrxEnabled() ||
    isLiveTonEnabled()
  );
}

/** Unique send amount so Tron transfers can be matched to one user. */
export function uniqueUsdtSendAmount(baseUsd: number, userId: string) {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h = Math.imul(h ^ userId.charCodeAt(i), 16777619);
  }
  const tag = (Math.abs(h) % 9999) / 1_000_000;
  return +(baseUsd + tag).toFixed(6);
}
