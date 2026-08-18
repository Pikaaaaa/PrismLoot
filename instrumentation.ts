export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPriceSync } = await import("@/lib/services/prices/sync");
    startPriceSync();
  }
}
