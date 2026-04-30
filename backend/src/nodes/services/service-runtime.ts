import { createInitialSwarmState } from "@omen/agents";
import {
  TRADEABLE_SYMBOLS,
  runSchema,
  runtimeConfigSchema,
  type RuntimeMode,
} from "@omen/shared";

export const createServiceSwarmState = (input: {
  runId: string;
  mode: RuntimeMode;
}) => {
  const timestamp = new Date().toISOString();

  return createInitialSwarmState({
    run: runSchema.parse({
      id: input.runId,
      mode: input.mode,
      status: "running",
      marketBias: "UNKNOWN",
      startedAt: timestamp,
      completedAt: null,
      triggeredBy: "system",
      activeCandidateCount: 0,
      currentCheckpointRefId: null,
      finalSignalId: null,
      finalIntelId: null,
      failureReason: null,
      outcome: null,
      configSnapshot: {
        source: "axl-mcp-service",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    config: runtimeConfigSchema.parse({
      id: "axl-mcp-runtime",
      mode: input.mode,
      marketUniverse: TRADEABLE_SYMBOLS,
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
      updatedAt: timestamp,
    }),
  });
};

export const isAxlOptionalLlmDisabled = (role: string) => {
  const raw = process.env.AXL_DISABLE_OPTIONAL_LLM_ROLES ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(role);
};
