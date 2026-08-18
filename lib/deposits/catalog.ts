export const DEPOSIT_ASSETS = ["USDT", "BTC", "TRX", "LTC", "ETH", "USDC"] as const;
export type DepositAsset = (typeof DEPOSIT_ASSETS)[number];

export type DepositNetworkId =
  | "trc20"
  | "erc20"
  | "bitcoin"
  | "tron"
  | "litecoin"
  | "ethereum";

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
  trc20: { id: "trc20", label: "TRC-20", confirmations: "19 блоков" },
  erc20: { id: "erc20", label: "ERC-20", confirmations: "12 блоков" },
  bitcoin: { id: "bitcoin", label: "Bitcoin", confirmations: "2 блока" },
  tron: { id: "tron", label: "TRON", confirmations: "19 блоков" },
  litecoin: { id: "litecoin", label: "Litecoin", confirmations: "6 блоков" },
  ethereum: { id: "ethereum", label: "Ethereum", confirmations: "12 блоков" },
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
    asset: "USDC",
    ticker: "USDC",
    name: "USD Coin",
    color: "#2775ca",
    usdRate: 1,
    minUsd: 5,
    networks: [NETWORKS.erc20, NETWORKS.trc20],
  },
];

const DEFAULT_ADDRESSES: Record<string, string> = {
  "USDT:trc20": "TPRISMDEMOUSDTTRC20XXXXXXXXXXXXXXX",
  "USDT:erc20": "0xDE00PRISMLOOTUSDTDEMO0000000000000001",
  "BTC:bitcoin": "bc1qprismlootdemodemo0000000000000000",
  "TRX:tron": "TPRISMDEMOTRXADDRESSXXXXXXXXXXXXXXX",
  "LTC:litecoin": "ltc1qprismlootdemodemo00000000000000",
  "ETH:ethereum": "0xDE00PRISMLOOTETHDEMO0000000000000002",
  "USDC:erc20": "0xDE00PRISMLOOTUSDCDEMO000000000000003",
  "USDC:trc20": "TPRISMDEMOUSDCTRC20XXXXXXXXXXXXXXX",
};

const ENV_KEYS: Record<string, string> = {
  "USDT:trc20": "DEPOSIT_ADDR_USDT_TRC20",
  "USDT:erc20": "DEPOSIT_ADDR_USDT_ERC20",
  "BTC:bitcoin": "DEPOSIT_ADDR_BTC",
  "TRX:tron": "DEPOSIT_ADDR_TRX",
  "LTC:litecoin": "DEPOSIT_ADDR_LTC",
  "ETH:ethereum": "DEPOSIT_ADDR_ETH",
  "USDC:erc20": "DEPOSIT_ADDR_USDC_ERC20",
  "USDC:trc20": "DEPOSIT_ADDR_USDC_TRC20",
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

export function publicDepositCatalog() {
  return DEPOSIT_COINS.map((coin) => ({
    ...coin,
    networks: coin.networks.map((network) => ({
      ...network,
      address: demoDepositAddress(coin.asset, network.id),
    })),
  }));
}
