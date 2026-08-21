const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DECIMALS = 1_000_000;

export type Trc20Transfer = {
  txId: string;
  from: string;
  to: string;
  amountUsdt: number;
  blockTimestamp: number;
};

function trongridHeaders() {
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.TRONGRID_API_KEY?.trim();
  if (key) headers["TRON-PRO-API-KEY"] = key;
  return headers;
}

function parseUsdtValue(raw: unknown) {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return +(n / USDT_DECIMALS).toFixed(6);
}

/** Fetch recent inbound USDT TRC-20 transfers to `depositAddress`. */
export async function listRecentUsdtDeposits(depositAddress: string, limit = 40): Promise<Trc20Transfer[]> {
  const address = depositAddress.trim();
  const url = new URL(`https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("contract_address", USDT_TRC20);
  url.searchParams.set("only_to", "true");

  const res = await fetch(url.toString(), { headers: trongridHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error("TRON_API_FAILED");
  const json = (await res.json()) as {
    data?: Array<{
      transaction_id?: string;
      from?: string;
      to?: string;
      value?: string;
      block_timestamp?: number;
    }>;
  };

  return (json.data ?? [])
    .map((row) => ({
      txId: row.transaction_id ?? "",
      from: row.from ?? "",
      to: row.to ?? "",
      amountUsdt: parseUsdtValue(row.value),
      blockTimestamp: row.block_timestamp ?? 0,
    }))
    .filter((row) => row.txId && row.to === address && row.amountUsdt > 0);
}

export function amountsMatch(expectedUsdt: number, actualUsdt: number, toleranceUsdt = 0.000002) {
  return Math.abs(actualUsdt - expectedUsdt) <= toleranceUsdt;
}
