import { SKINS } from "@/data/skins";
import { PRICE_SYNC_INTERVAL_MS } from "@/lib/economy/config";
import { refreshSkinPrice } from "./priceProvider";

let timer: ReturnType<typeof setInterval> | null = null;

const PROBE_ID = "ak-redline";

/**
 * Background refresh every 5–15 minutes. Tries one live Steam quote as a probe.
 * Never synthesizes a price when the live API fails — last snapshot stays.
 */
export async function runPriceSyncTick() {
  const ids = SKINS.some((s) => s.id === PROBE_ID) ? [PROBE_ID] : SKINS.slice(0, 1).map((s) => s.id);
  for (const id of ids) {
    try {
      await refreshSkinPrice(id);
    } catch {
      /* keep last snapshot */
    }
  }
}

export function startPriceSync() {
  if (timer) return;
  void runPriceSyncTick();
  timer = setInterval(() => {
    void runPriceSyncTick();
  }, PRICE_SYNC_INTERVAL_MS);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}
