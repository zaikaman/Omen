import { createInitialSwarmState } from "@omen/agents";
import { AxlHttpAdapter } from "@omen/axl";
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

const parsePort = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const rolePeerEnvByService: Record<string, string> = {
  market_bias: "AXL_MARKET_BIAS_NODE_ID",
  scanner: "AXL_SCANNER_NODE_ID",
  research: "AXL_RESEARCH_NODE_ID",
  chart_vision: "AXL_CHART_VISION_NODE_ID",
  analyst: "AXL_ANALYST_NODE_ID",
  critic: "AXL_CRITIC_NODE_ID",
  intel: "AXL_INTEL_NODE_ID",
  generator: "AXL_GENERATOR_NODE_ID",
  writer: "AXL_WRITER_NODE_ID",
  memory: "AXL_MEMORY_NODE_ID",
  publisher: "AXL_PUBLISHER_NODE_ID",
};

const isValidAxlPeerId = (value: string) => /^[0-9a-f]{64}$/i.test(value);

export const resolveAxlPeerIdForService = (service: string) => {
  const envName = rolePeerEnvByService[service];
  const configured = envName ? process.env[envName]?.trim() : "";

  if (configured && isValidAxlPeerId(configured)) {
    return configured;
  }

  throw new Error(`No explicit AXL peer ID is configured for ${service}. Set ${envName}.`);
};

export const createServiceAxlMcpAdapter = () => {
  const baseUrl = process.env.OMEN_MCP_AXL_API_BASE_URL ?? process.env.AXL_NODE_BASE_URL ?? "";

  if (!baseUrl) {
    throw new Error(
      "OMEN_MCP_AXL_API_BASE_URL or AXL_NODE_BASE_URL is required for peer-to-peer AXL MCP calls.",
    );
  }

  return new AxlHttpAdapter({
    node: {
      baseUrl,
      requestTimeoutMs: parsePort(process.env.OMEN_MCP_AXL_REQUEST_TIMEOUT_MS, 300_000),
      defaultHeaders: {},
    },
  });
};
