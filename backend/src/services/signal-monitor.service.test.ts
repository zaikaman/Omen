import { describe, expect, it } from "vitest";

import {
  calculateSignalTrackingState,
  hasLimitEntryTriggered,
} from "./signal-monitor.service.js";

describe("signal monitor tracking", () => {
  it("keeps an unfilled short limit order pending above current price", () => {
    expect(
      hasLimitEntryTriggered({
        direction: "SHORT",
        entryPrice: 85.81,
        currentPrice: 83.91,
      }),
    ).toBe(false);

    expect(
      calculateSignalTrackingState({
        direction: "SHORT",
        orderType: "limit",
        signalStatus: "pending",
        entryPrice: 85.81,
        targetPrice: 68.22,
        stopLoss: 90.1,
        currentPrice: 83.91,
      }),
    ).toEqual({
      status: "pending",
      pnlPercent: null,
      riskReward: null,
      closed: false,
    });
  });

  it("activates tracking once a short limit entry is reached", () => {
    const result = calculateSignalTrackingState({
      direction: "SHORT",
      orderType: "limit",
      signalStatus: "pending",
      entryPrice: 85.81,
      targetPrice: 68.22,
      stopLoss: 90.1,
      currentPrice: 85.9,
    });

    expect(result.status).toBe("active");
    expect(result.pnlPercent).toBeLessThan(0);
    expect(result.riskReward).toBeGreaterThan(2);
    expect(result.closed).toBe(false);
  });

  it("uses template-style tolerance when checking limit entries", () => {
    expect(
      hasLimitEntryTriggered({
        direction: "LONG",
        entryPrice: 100,
        currentPrice: 100.49,
      }),
    ).toBe(true);
    expect(
      hasLimitEntryTriggered({
        direction: "SHORT",
        entryPrice: 100,
        currentPrice: 99.51,
      }),
    ).toBe(true);
  });
});
