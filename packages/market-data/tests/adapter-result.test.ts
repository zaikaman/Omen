import { describe, expect, it } from "vitest";

import {
  BinanceAdapter,
  createProviderFailure,
  createProviderSuccess,
} from "../src/index.js";

describe("market-data provider results", () => {
  it("creates typed success and failure result unions", () => {
    const success = createProviderSuccess({
      provider: "binance",
      value: { symbol: "BTC" },
    });
    const failure = createProviderFailure({
      provider: "news",
      code: "NEWS_DOWN",
      message: "provider unavailable",
      retryable: true,
    });

    expect(success.ok).toBe(true);
    expect(success.health.available).toBe(true);
    expect(failure.ok).toBe(false);
    expect(failure.health.degraded).toBe(true);
  });

  it("returns a placeholder market snapshot for the adapter shell", async () => {
    const adapter = new BinanceAdapter();
    const result = await adapter.getMarketSnapshot("btc");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.symbol).toBe("BTC");
      expect(result.value.provider).toBe("binance");
    }
  });
});
