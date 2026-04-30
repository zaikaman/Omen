import {
  AxlA2AClient,
  AxlHttpNodeAdapter,
  createDelegationRequest,
} from "../packages/axl/src/index.js";
import {
  analystOutputSchema,
  chartVisionOutputSchema,
  criticOutputSchema,
  generatorOutputSchema,
  intelOutputSchema,
  marketBiasAgentOutputSchema,
  memoryOutputSchema,
  publisherOutputSchema,
  researchOutputSchema,
  scannerOutputSchema,
  writerOutputSchema,
} from "../packages/agents/src/index.js";

const baseUrl = process.env.AXL_NODE_BASE_URL ?? "https://omen-axl-node.fly.dev";
const timeoutMs = Number(process.env.AXL_REQUEST_TIMEOUT_MS ?? "120000");
const adapter = new AxlHttpNodeAdapter({
  node: {
    baseUrl,
    requestTimeoutMs: timeoutMs,
    defaultHeaders: {},
  },
});
const client = new AxlA2AClient(adapter);
const runId = `manual-a2a-${Date.now().toString()}`;
const context = {
  runId,
  threadId: `${runId}:thread`,
  mode: "production_like",
  triggeredBy: "system",
} as const;
const candidate = {
  id: "candidate-btc-a2a",
  symbol: "BTC",
  reason: "A2A verification candidate.",
  directionHint: "LONG",
  status: "researched",
  sourceUniverse: "BTC,ETH,SOL",
  dedupeKey: "BTC",
  missingDataNotes: [],
} as const;
const evidence = [
  {
    category: "market",
    summary: "BTC spot snapshot recorded 65000 with 24h change 2.4%.",
    sourceLabel: "A2A verifier",
    sourceUrl: null,
    structuredData: { price: 65000, currentPrice: 65000, change24hPercent: 2.4 },
  },
  {
    category: "technical",
    summary: "BTC held trend support and reclaimed local range highs.",
    sourceLabel: "A2A verifier",
    sourceUrl: null,
    structuredData: {},
  },
  {
    category: "sentiment",
    summary: "Major asset flow stayed constructive around BTC.",
    sourceLabel: "A2A verifier",
    sourceUrl: null,
    structuredData: {},
  },
] as const;
const thesis = {
  candidateId: candidate.id,
  asset: "BTC",
  direction: "LONG",
  confidence: 90,
  orderType: "limit",
  tradingStyle: "day_trade",
  expectedDuration: "8-16 hours",
  currentPrice: 65000,
  entryPrice: 64800,
  targetPrice: 72000,
  stopLoss: 62000,
  riskReward: 2.4,
  whyNow: "BTC reclaimed local range highs with multi-source confirmation.",
  confluences: ["Range reclaim", "Constructive sentiment"],
  uncertaintyNotes: "Macro follow-through still matters.",
  missingDataNotes: "No additional missing-data flags.",
} as const;
const review = {
  candidateId: candidate.id,
  decision: "approved",
  objections: [],
  forcedOutcomeReason: null,
} as const;
const report = {
  topic: "BTC liquidity rotation",
  insight:
    "BTC liquidity and high-throughput infra attention improved while majors held constructive ranges.",
  importanceScore: 8,
  category: "market_update",
  title: "BTC liquidity rotation",
  summary:
    "BTC liquidity and major-asset attention improved while the market held constructive ranges.",
  confidence: 82,
  symbols: ["BTC"],
  imagePrompt: null,
} as const;
const generatedContent = {
  topic: "BTC liquidity rotation",
  tweetText:
    "BTC liquidity rotation is back on watch as majors hold constructive ranges and attention returns to high-quality market structure.",
  blogPost: null,
  imagePrompt: null,
  formattedContent: null,
  logMessage: null,
} as const;

const tasks = [
  {
    role: "market_bias",
    taskType: "market_bias.derive",
    schema: marketBiasAgentOutputSchema,
    payload: { context, snapshots: [], narratives: [] },
  },
  {
    role: "scanner",
    taskType: "scan.run",
    schema: scannerOutputSchema,
    payload: {
      context,
      bias: { marketBias: "LONG", reasoning: "A2A verification bias.", confidence: 70 },
      universe: ["BTC", "ETH", "SOL"],
      activeTradeSymbols: [],
    },
  },
  {
    role: "research",
    taskType: "research.bundle",
    schema: researchOutputSchema,
    payload: { context, candidate },
  },
  {
    role: "chart_vision",
    taskType: "chart_vision.analyze",
    schema: chartVisionOutputSchema,
    payload: { context, candidate },
  },
  {
    role: "analyst",
    taskType: "thesis.generate",
    schema: analystOutputSchema,
    payload: {
      context,
      research: {
        candidate,
        evidence,
        narrativeSummary: "BTC remains constructive.",
        chartVisionSummary: "BTC 1h chart shows trend leaning upward.",
        chartVisionTimeframes: ["1h"],
        missingDataNotes: [],
      },
    },
  },
  {
    role: "critic",
    taskType: "critic.review",
    schema: criticOutputSchema,
    payload: { context, evaluation: { thesis, evidence } },
  },
  {
    role: "intel",
    taskType: "intel.summarize",
    schema: intelOutputSchema,
    payload: {
      context,
      bias: { marketBias: "LONG", reasoning: "A2A verification bias.", confidence: 70 },
      candidates: [],
      evidence,
      chartVisionSummary: null,
      thesis: null,
      review: null,
      recentIntelHistory: [],
      recentPostContext: [],
    },
  },
  {
    role: "generator",
    taskType: "generator.compose",
    schema: generatorOutputSchema,
    payload: { context, report, evidence },
  },
  {
    role: "writer",
    taskType: "writer.article",
    schema: writerOutputSchema,
    payload: { context, report, evidence, generatedContent },
  },
  {
    role: "memory",
    taskType: "memory.checkpoint",
    schema: memoryOutputSchema,
    payload: {
      context,
      checkpointLabel: "a2a-verification",
      notes: ["A2A verification checkpoint"],
      proofArtifacts: [],
    },
  },
  {
    role: "publisher",
    taskType: "publisher.publish",
    schema: publisherOutputSchema,
    payload: { context, thesis, review, intelSummary: report, generatedContent },
  },
] as const;

const summarize = (role: string, output: Record<string, unknown>) => {
  if (role === "market_bias")
    return { marketBias: output.marketBias, confidence: output.confidence };
  if (role === "scanner") return { candidateCount: (output.candidates as unknown[]).length };
  if (role === "research") return { evidenceCount: (output.evidence as unknown[]).length };
  if (role === "chart_vision") return { frameCount: (output.frames as unknown[]).length };
  if (role === "analyst")
    return { thesis: (output.thesis as { asset: string; direction: string }).asset };
  if (role === "critic") return { decision: (output.review as { decision: string }).decision };
  if (role === "intel") return { action: output.action };
  if (role === "generator") return { hasContent: Boolean(output.content) };
  if (role === "writer") return { hasArticle: Boolean(output.article) };
  if (role === "memory") return { checkpointRefId: output.checkpointRefId };
  if (role === "publisher") return { outcome: output.outcome };
  return {};
};

const main = async () => {
  const topology = await adapter.client.getTopology();

  if (!topology.ok) {
    throw topology.error;
  }

  const peerId = topology.value.our_public_key;
  const results = [];

  for (const task of tasks) {
    const started = Date.now();
    const request = createDelegationRequest({
      delegationId: `${runId}:${task.role}`,
      runId,
      correlationId: `${runId}:${task.role}`,
      fromPeerId: peerId,
      fromRole: "orchestrator",
      toPeerId: peerId,
      requestedRole: task.role,
      taskType: task.taskType,
      requiredServices: [task.taskType],
      payload: task.payload,
      timeoutMs,
      routeHints: ["manual-live-a2a-verification"],
    });
    const delegated = await client.delegate({ peerId, request });

    if (!delegated.ok) {
      results.push({
        role: task.role,
        taskType: task.taskType,
        ok: false,
        elapsedMs: Date.now() - started,
        error: delegated.error.message,
      });
      continue;
    }

    const result = delegated.value.result;
    const parsed = task.schema.safeParse(result?.output);
    results.push({
      role: task.role,
      taskType: task.taskType,
      ok: result?.state === "completed" && parsed.success,
      state: result?.state ?? null,
      responderRole: result?.responderRole ?? null,
      elapsedMs: Date.now() - started,
      schemaOk: parsed.success,
      schemaError: parsed.success ? null : parsed.error.message,
      summary: parsed.success ? summarize(task.role, parsed.data as Record<string, unknown>) : {},
    });
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        peerId,
        runId,
        allOk: results.every((result) => result.ok),
        results,
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
