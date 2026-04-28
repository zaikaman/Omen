import { describe, expect, it } from "vitest";

import { createInitialSwarmState, mergeSwarmState, swarmStateSchema } from "../src/index.js";

describe("agent runtime state", () => {
  const run = {
    id: "run-1",
    mode: "mocked" as const,
    status: "queued" as const,
    marketBias: "UNKNOWN" as const,
    startedAt: null,
    completedAt: null,
    triggeredBy: "scheduler" as const,
    activeCandidateCount: 0,
    currentCheckpointRefId: null,
    finalSignalId: null,
    finalIntelId: null,
    failureReason: null,
    outcome: null,
    configSnapshot: {},
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:00.000Z",
  };

  const config = {
    id: "default",
    mode: "mocked" as const,
    marketUniverse: ["BTC", "ETH"],
    qualityThresholds: {
      minConfidence: 85,
      minRiskReward: 2,
      minConfluences: 2,
    },
    providers: {
      axl: { enabled: true, required: true },
      zeroGStorage: { enabled: true, required: true },
      zeroGCompute: { enabled: true, required: false },
      binance: { enabled: true, required: false },
      coinGecko: { enabled: true, required: false },
      defiLlama: { enabled: true, required: false },
      news: { enabled: true, required: false },
      twitterapi: { enabled: true, required: false },
    },
    paperTradingEnabled: true,
    testnetExecutionEnabled: false,
    mainnetExecutionEnabled: false,
    postToXEnabled: true,
    scanIntervalMinutes: 60,
    updatedAt: "2026-04-25T08:00:00.000Z",
  };

  it("creates an empty initial swarm state", () => {
    const state = createInitialSwarmState({ run, config });

    expect(state.run.id).toBe("run-1");
    expect(state.activeCandidates).toEqual([]);
    expect(state.activeTradeSymbols).toEqual([]);
    expect(state.events).toEqual([]);
    expect(() => swarmStateSchema.parse(state)).not.toThrow();
  });

  it("merges state updates while preserving untouched fields", () => {
    const state = createInitialSwarmState({ run, config });
    const merged = mergeSwarmState(state, {
      marketBiasReasoning: "BTC strength confirmed",
      notes: ["scanner started"],
    });

    expect(merged.marketBiasReasoning).toBe("BTC strength confirmed");
    expect(merged.notes).toEqual(["scanner started"]);
    expect(merged.run.id).toBe("run-1");
  });
});
