import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createMemoryAgent } from "../src/index.js";

describe("memory agent", () => {
  const run = {
    id: "run-1",
    mode: "mocked" as const,
    status: "queued" as const,
    marketBias: "LONG" as const,
    startedAt: null,
    completedAt: null,
    triggeredBy: "scheduler" as const,
    activeCandidateCount: 1,
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
    marketUniverse: ["BTC", "ETH", "SOL"],
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

  it("builds a stable checkpoint ref and appended proof list", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createMemoryAgent();

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        checkpointLabel: "critic approved",
        notes: ["stored final debate snapshot", "ready for publisher"],
        proofArtifacts: [
          {
            id: "proof-1",
            runId: run.id,
            signalId: null,
            intelId: null,
            refType: "kv_state",
            key: "runs/run-1/checkpoint",
            locator: "0g://kv/runs/run-1/checkpoint",
            metadata: {},
            compute: null,
            createdAt: "2026-04-25T08:00:00.000Z",
          },
          {
            id: "proof-2",
            runId: run.id,
            signalId: null,
            intelId: null,
            refType: "manifest",
            key: "runs/run-1/manifest",
            locator: "0g://file/runs/run-1/manifest.json",
            metadata: {},
            compute: null,
            createdAt: "2026-04-25T08:01:00.000Z",
          },
        ],
      },
      state,
    );

    expect(result.checkpointRefId).toBe("checkpoint-run-1-critic-approved");
    expect(result.appendedProofRefs ?? []).toContain("proof-1");
    expect(result.appendedProofRefs ?? []).toContain("proof-2");
    expect((result.appendedProofRefs ?? []).some((entry) => entry.startsWith("note:"))).toBe(true);
    expect((result.appendedProofRefs ?? []).some((entry) => entry.startsWith("prompt:"))).toBe(
      false,
    );
  });
});
