import {
  isLiveBtcEnabled,
  isLiveEthEnabled,
  isLiveSolEnabled,
  isLiveTonEnabled,
  isLiveTrxEnabled,
  isLiveUsdcBep20Enabled,
  isLiveUsdtTrc20Enabled,
  isValidBscAddress,
  isValidBtcAddress,
  isValidEthAddress,
  isValidSolAddress,
  isValidTonAddress,
  isValidTronAddress,
  liveBtcAddress,
  liveEthAddress,
  liveSolAddress,
  liveTonAddress,
  liveTrxAddress,
  liveUsdcBep20Address,
  liveUsdtTrc20Address,
} from "@/lib/deposits/live";

export const DEPOSIT_ASSETS = ["USDT", "BTC", "TRX", "LTC", "ETH", "SOL", "USDC", "TON"] as const;
export type DepositAsset = (typeof DEPOSIT_ASSETS)[number];

export type DepositNetworkId =
  | "trc20"
  | "erc20"
  | "bep20"
  | "bitcoin"
  | "tron"
  | "litecoin"
  | "ethereum"
  | "solana"
  | "ton";

export type DepositNetwork = {
  id: DepositNetworkId;
  label: string;
  confirmations: string;
};

export type DepositCoin = {
  asset: DepositAsset;
  ticker: string;
  name: string;
  color: string;
  usdRate: number;
  minUsd: number;
  networks: DepositNetwork[];
};

const NETWORKS: Record<DepositNetworkId, DepositNetwork> = {
  trc20: { id: "trc20", label: "TRC-20", confirmations: "19 blocks" },
  erc20: { id: "erc20", label: "ERC-20", confirmations: "12 blocks" },
  bep20: { id: "bep20", label: "BSC (BEP20)", confirmations: "15 blocks" },
  bitcoin: { id: "bitcoin", label: "Bitcoin", confirmations: "2 blocks" },
  tron: { id: "tron", label: "TRON (TRC20)", confirmations: "19 blocks" },
  litecoin: { id: "litecoin", label: "Litecoin", confirmations: "6 blocks" },
  ethereum: { id: "ethereum", label: "Ethereum (ERC20)", confirmations: "12 blocks" },
  solana: { id: "solana", label: "SOL", confirmations: "1 block" },
  ton: { id: "ton", label: "TON", confirmations: "1 block" },
};

/** Demo FX only — not live quotes. */
export const DEPOSIT_COINS: DepositCoin[] = [
  {
    asset: "USDT",
    ticker: "USDT",
    name: "Tether",
    color: "#26a17b",
    usdRate: 1,
    minUsd: 5,
    networks: [NETWORKS.trc20, NETWORKS.erc20],
  },
  {
    asset: "BTC",
    ticker: "BTC",
    name: "Bitcoin",
    color: "#f7931a",
    usdRate: 95000,
    minUsd: 20,
    networks: [NETWORKS.bitcoin],
  },
  {
    asset: "TRX",
    ticker: "TRX",
    name: "TRON",
    color: "#ef0027",
    usdRate: 0.12,
    minUsd: 5,
    networks: [NETWORKS.tron],
  },
  {
    asset: "LTC",
    ticker: "LTC",
    name: "Litecoin",
    color: "#345d9d",
    usdRate: 85,
    minUsd: 10,
    networks: [NETWORKS.litecoin],
  },
  {
    asset: "ETH",
    ticker: "ETH",
    name: "Ethereum",
    color: "#627eea",
    usdRate: 3200,
    minUsd: 15,
    networks: [NETWORKS.ethereum],
  },
  {
    asset: "SOL",
    ticker: "SOL",
    name: "Solana",
    color: "#9945ff",
    usdRate: 180,
    minUsd: 10,
    networks: [NETWORKS.solana],
  },
  {
    asset: "USDC",
    ticker: "USDC",
    name: "USD Coin",
    color: "#2775ca",
    usdRate: 1,
    minUsd: 5,
    networks: [NETWORKS.erc20, NETWORKS.trc20, NETWORKS.bep20],
  },
  {
    asset: "TON",
    ticker: "TON",
    name: "Toncoin",
    color: "#0098EA",
    usdRate: 5.5,
    minUsd: 5,
    networks: [NETWORKS.ton],
  },
];

const DEFAULT_ADDRESSES: Record<string, string> = {
  "USDT:trc20": "TPRISMDEMOUSDTTRC20XXXXXXXXXXXXXXX",
  "USDT:erc20": "0xDE00PRISMLOOTUSDTDEMO0000000000000001",
  "BTC:bitcoin": "bc1qprismlootdemodemo0000000000000000",
  "TRX:tron": "TPRISMDEMOTRXADDRESSXXXXXXXXXXXXXXX",
  "LTC:litecoin": "ltc1qprismlootdemodemo00000000000000",
  "ETH:ethereum": "0xDE00PRISMLOOTETHDEMO0000000000000002",
  "SOL:solana": "PRISMDEMOSOLADDRESSXXXXXXXXXXXXXXXXXXXX",
  "USDC:erc20": "0xDE00PRISMLOOTUSDCDEMO000000000000003",
  "USDC:trc20": "TPRISMDEMOUSDCTRC20XXXXXXXXXXXXXXX",
  "USDC:bep20": "0xDE00PRISMLOOTUSDCBEP20DEMO0000000001",
  "TON:ton": "UQPRISMDEMOTONADDRESSXXXXXXXXXXXXXXXXXXXXXXX",
};

const ENV_KEYS: Record<string, string> = {
  "USDT:trc20": "DEPOSIT_ADDR_USDT_TRC20",
  "USDT:erc20": "DEPOSIT_ADDR_USDT_ERC20",
  "BTC:bitcoin": "DEPOSIT_ADDR_BTC",
  "TRX:tron": "DEPOSIT_ADDR_TRX",
  "LTC:litecoin": "DEPOSIT_ADDR_LTC",
  "ETH:ethereum": "DEPOSIT_ADDR_ETH",
  "SOL:solana": "DEPOSIT_ADDR_SOL",
  "USDC:erc20": "DEPOSIT_ADDR_USDC_ERC20",
  "USDC:trc20": "DEPOSIT_ADDR_USDC_TRC20",
  "USDC:bep20": "DEPOSIT_ADDR_USDC_BEP20",
  "TON:ton": "DEPOSIT_ADDR_TON",
};

export function isDepositAsset(value: string): value is DepositAsset {
  return (DEPOSIT_ASSETS as readonly string[]).includes(value);
}

export function getDepositCoin(asset: string) {
  return DEPOSIT_COINS.find((coin) => coin.asset === asset) ?? null;
}

export function getDepositNetwork(coin: DepositCoin, networkId: string) {
  return coin.networks.find((row) => row.id === networkId) ?? null;
}

export function demoDepositAddress(asset: DepositAsset, networkId: string) {
  const key = `${asset}:${networkId}`;
  if (key === "USDT:trc20") {
    const addr = liveUsdtTrc20Address();
    if (isValidTronAddress(addr)) return addr;
    return DEFAULT_ADDRESSES[key] || "";
  }
  if (key === "BTC:bitcoin") {
    const addr = liveBtcAddress();
    if (isValidBtcAddress(addr)) return addr;
    return DEFAULT_ADDRESSES[key] || "";
  }
  if (key === "ETH:ethereum") {
    const addr = liveEthAddress();
    if (isValidEthAddress(addr)) return addr;
    return DEFAULT_ADDRESSES[key] || "";
  }
  if (key === "SOL:solana") {
    const addr = liveSolAddress();
    if (isValidSolAddress(addr)) return addr;
    return DEFAULT_ADDRESSES[key] || "";
  }
  if (key === "USDC:bep20") {
    const addr = liveUsdcBep20Address();
    if (isValidBscAddress(addr)) return addr;
    return DEFAULT_ADDRESSES[key] || "";
  }
  if (key === "TRX:tron") {
    const addr = liveTrxAddress();
    if (isValidTronAddress(addr)) return addr;
    return DEFAULT_ADDRESSES[key] || "";
  }
  if (key === "TON:ton") {
    const addr = liveTonAddress();
    if (isValidTonAddress(addr)) return addr;
    return DEFAULT_ADDRESSES[key] || "";
  }
  const envName = ENV_KEYS[key];
  const fromEnv = envName ? process.env[envName]?.trim() : "";
  return fromEnv || DEFAULT_ADDRESSES[key] || "";
}

export function cryptoFromUsd(amountUsd: number, usdRate: number) {
  if (!(usdRate > 0)) return 0;
  const raw = amountUsd / usdRate;
  if (raw >= 1) return +raw.toFixed(6);
  return +raw.toFixed(8);
}

function liveDepositCoins() {
  const coins: DepositCoin[] = [];
  if (isLiveUsdtTrc20Enabled()) {
    const usdt = DEPOSIT_COINS.find((coin) => coin.asset === "USDT");
    if (usdt) {
      coins.push({
        ...usdt,
        networks: usdt.networks.filter((row) => row.id === "trc20"),
      });
    }
  }
  if (isLiveBtcEnabled()) {
    const btc = DEPOSIT_COINS.find((coin) => coin.asset === "BTC");
    if (btc) {
      coins.push({
        ...btc,
        networks: btc.networks.filter((row) => row.id === "bitcoin"),
      });
    }
  }
  if (isLiveEthEnabled()) {
    const eth = DEPOSIT_COINS.find((coin) => coin.asset === "ETH");
    if (eth) {
      coins.push({
        ...eth,
        networks: eth.networks.filter((row) => row.id === "ethereum"),
      });
    }
  }
  if (isLiveSolEnabled()) {
    const sol = DEPOSIT_COINS.find((coin) => coin.asset === "SOL");
    if (sol) {
      coins.push({
        ...sol,
        networks: sol.networks.filter((row) => row.id === "solana"),
      });
    }
  }
  if (isLiveUsdcBep20Enabled()) {
    const usdc = DEPOSIT_COINS.find((coin) => coin.asset === "USDC");
    if (usdc) {
      coins.push({
        ...usdc,
        networks: usdc.networks.filter((row) => row.id === "bep20"),
      });
    }
  }
  if (isLiveTrxEnabled()) {
    const trx = DEPOSIT_COINS.find((coin) => coin.asset === "TRX");
    if (trx) {
      coins.push({
        ...trx,
        networks: trx.networks.filter((row) => row.id === "tron"),
      });
    }
  }
  if (isLiveTonEnabled()) {
    const ton = DEPOSIT_COINS.find((coin) => coin.asset === "TON");
    if (ton) {
      coins.push({
        ...ton,
        networks: ton.networks.filter((row) => row.id === "ton"),
      });
    }
  }
  return coins;
}

export function publicDepositCatalog() {
  const liveCoins = liveDepositCoins();
  const coins = liveCoins.length ? liveCoins : DEPOSIT_COINS;

  return coins.map((coin) => ({
    ...coin,
    networks: coin.networks.map((network) => ({
      ...network,
      address: demoDepositAddress(coin.asset, network.id),
    })),
  }));
}
