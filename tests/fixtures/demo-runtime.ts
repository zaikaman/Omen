import {
  OMEN_DISCLAIMER,
  analyticsSnapshotSchema,
  agentEventSchema,
  agentNodeSchema,
  axlEnvelopeSchema,
  dashboardSummarySchema,
  intelSchema,
  outboundPostSchema,
  proofArtifactSchema,
  runProofBundleSchema,
  runSchema,
  runtimeConfigSchema,
  schedulerStatusSchema,
  signalSchema,
} from "../../packages/shared/src/index";

const baseTime = "2026-04-25T08:00:00.000Z";
const signalStartedAt = "2026-04-25T08:00:00.000Z";
const signalCompletedAt = "2026-04-25T08:06:00.000Z";
const intelStartedAt = "2026-04-25T09:00:00.000Z";
const intelCompletedAt = "2026-04-25T09:04:00.000Z";

export const demoRuntimeConfig = runtimeConfigSchema.parse({
  id: "default",
  mode: "live",
  marketUniverse: ["BTC", "ETH", "SOL", "TAO", "RNDR", "AKT"],
  qualityThresholds: {
    minConfidence: 80,
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
  updatedAt: baseTime,
});

export const demoSchedulerStatus = schedulerStatusSchema.parse({
  enabled: true,
  isRunning: false,
  nextRunAt: "2026-04-25T10:00:00.000Z",
  lastRunAt: intelCompletedAt,
  scanIntervalMinutes: 60,
  overlapPrevented: true,
});

const demoAgentNodes = [
  ["agent-orchestrator-001", "orchestrator", "axl"],
  ["agent-scanner-001", "scanner", "axl"],
  ["agent-research-001", "research", "axl"],
  ["agent-analyst-001", "analyst", "axl"],
  ["agent-critic-001", "critic", "axl"],
  ["agent-publisher-001", "publisher", "local"],
  ["agent-memory-001", "memory", "local"],
].map(([id, role, transport]) =>
  agentNodeSchema.parse({
    id,
    role,
    transport,
    status: "online",
    peerId: transport === "axl" ? `peer-${role}` : null,
    lastHeartbeatAt: intelCompletedAt,
    lastError: null,
    metadata: { region: transport === "axl" ? "axl" : "backend" },
  }),
);

const makeProof = (input: {
  id: string;
  runId: string;
  signalId: string | null;
  intelId: string | null;
  refType: "kv_state" | "log_bundle" | "compute_result" | "manifest" | "post_result";
  createdAt: string;
  compute?: boolean;
}) =>
  proofArtifactSchema.parse({
    id: input.id,
    runId: input.runId,
    signalId: input.signalId,
    intelId: input.intelId,
    refType: input.refType,
    key: `runs/${input.runId}/${input.id}`,
    locator: `0g://proof/${input.runId}/${input.id}`,
    metadata: { provider: input.refType === "post_result" ? "twitterapi" : "0g" },
    compute: input.compute
      ? {
          provider: "0g-compute",
          model: "glm-5",
          jobId: `job-${input.id}`,
          requestHash: `req-${input.id}`,
          responseHash: `res-${input.id}`,
          verificationMode: "tee",
        }
      : null,
    createdAt: input.createdAt,
  });

const signalRun = runSchema.parse({
  id: "run-signal-001",
  mode: "live",
  status: "completed",
  marketBias: "LONG",
  startedAt: signalStartedAt,
  completedAt: signalCompletedAt,
  triggeredBy: "scheduler",
  activeCandidateCount: 2,
  currentCheckpointRefId: "proof-signal-kv-001",
  finalSignalId: "signal-btc-long-001",
  finalIntelId: null,
  failureReason: null,
  outcome: {
    outcomeType: "signal",
    summary: "BTC long setup approved after scanner, analyst, and critic convergence.",
    signalId: "signal-btc-long-001",
    intelId: null,
  },
  configSnapshot: demoRuntimeConfig,
  createdAt: signalStartedAt,
  updatedAt: signalCompletedAt,
});

const signalProofs = [
  makeProof({
    id: "proof-signal-kv-001",
    runId: signalRun.id,
    signalId: "signal-btc-long-001",
    intelId: null,
    refType: "kv_state",
    createdAt: "2026-04-25T08:05:00.000Z",
  }),
  makeProof({
    id: "proof-signal-log-001",
    runId: signalRun.id,
    signalId: "signal-btc-long-001",
    intelId: null,
    refType: "log_bundle",
    createdAt: "2026-04-25T08:05:15.000Z",
  }),
  makeProof({
    id: "proof-signal-compute-001",
    runId: signalRun.id,
    signalId: "signal-btc-long-001",
    intelId: null,
    refType: "compute_result",
    createdAt: "2026-04-25T08:05:30.000Z",
    compute: true,
  }),
  makeProof({
    id: "proof-signal-manifest-001",
    runId: signalRun.id,
    signalId: "signal-btc-long-001",
    intelId: null,
    refType: "manifest",
    createdAt: signalCompletedAt,
  }),
  makeProof({
    id: "proof-signal-post-001",
    runId: signalRun.id,
    signalId: "signal-btc-long-001",
    intelId: null,
    refType: "post_result",
    createdAt: "2026-04-25T08:06:10.000Z",
  }),
];

const signalRecord = signalSchema.parse({
  id: "signal-btc-long-001",
  runId: signalRun.id,
  candidateId: "candidate-btc-breakout-001",
  asset: "BTC",
  direction: "LONG",
  confidence: 91,
  orderType: "market",
  tradingStyle: "day_trade",
  expectedDuration: "8-16h",
  currentPrice: 92750,
  entryPrice: 92800,
  targetPrice: 94850,
  stopLoss: 91800,
  signalStatus: "tp_hit",
  pnlPercent: 2.21,
  closedAt: "2026-04-25T12:00:00.000Z",
  priceUpdatedAt: "2026-04-25T12:00:00.000Z",
  riskReward: 2.8,
  entryZone: { low: 92450, high: 92800, rationale: "Retest of intraday breakout zone" },
  invalidation: { low: 91550, high: 91800, rationale: "Loss of breakout structure" },
  targets: [
    { label: "TP1", price: 93900 },
    { label: "TP2", price: 94850 },
  ],
  whyNow: "BTC reclaimed range highs while funding stayed contained and spot-led strength held.",
  confluences: ["4H breakout above local resistance", "Positive spot-led order flow"],
  uncertaintyNotes: "Macro headlines can still interrupt follow-through.",
  missingDataNotes: "Direct exchange L2 was unavailable for this fixture.",
  criticDecision: "approved",
  reportStatus: "published",
  finalReportRefId: "proof-signal-manifest-001",
  proofRefIds: signalProofs.map((proof) => proof.id),
  disclaimer: OMEN_DISCLAIMER,
  publishedAt: "2026-04-25T08:06:10.000Z",
  createdAt: "2026-04-25T08:04:30.000Z",
  updatedAt: "2026-04-25T08:06:10.000Z",
});

const intelRun = runSchema.parse({
  id: "run-intel-001",
  mode: "live",
  status: "completed",
  marketBias: "NEUTRAL",
  startedAt: intelStartedAt,
  completedAt: intelCompletedAt,
  triggeredBy: "scheduler",
  activeCandidateCount: 3,
  currentCheckpointRefId: "proof-intel-kv-001",
  finalSignalId: null,
  finalIntelId: "intel-ai-rotation-001",
  failureReason: null,
  outcome: {
    outcomeType: "intel",
    summary: "AI infrastructure rotation published as market news.",
    signalId: null,
    intelId: "intel-ai-rotation-001",
  },
  configSnapshot: demoRuntimeConfig,
  createdAt: intelStartedAt,
  updatedAt: intelCompletedAt,
});

const intelProofs = [
  makeProof({
    id: "proof-intel-kv-001",
    runId: intelRun.id,
    signalId: null,
    intelId: "intel-ai-rotation-001",
    refType: "kv_state",
    createdAt: "2026-04-25T09:02:30.000Z",
  }),
  makeProof({
    id: "proof-intel-log-001",
    runId: intelRun.id,
    signalId: null,
    intelId: "intel-ai-rotation-001",
    refType: "log_bundle",
    createdAt: "2026-04-25T09:03:00.000Z",
  }),
  makeProof({
    id: "proof-intel-manifest-001",
    runId: intelRun.id,
    signalId: null,
    intelId: "intel-ai-rotation-001",
    refType: "manifest",
    createdAt: intelCompletedAt,
  }),
  makeProof({
    id: "proof-intel-post-001",
    runId: intelRun.id,
    signalId: null,
    intelId: "intel-ai-rotation-001",
    refType: "post_result",
    createdAt: "2026-04-25T09:04:20.000Z",
  }),
];

const intelRecord = intelSchema.parse({
  id: "intel-ai-rotation-001",
  runId: intelRun.id,
  title: "AI Infrastructure Rotation",
  slug: "ai-infrastructure-rotation-2026-04-25",
  summary:
    "AI infrastructure tokens are gaining market attention as liquidity rotates into compute and data themes. TAO, RNDR, and AKT show stronger mindshare while BTC consolidates.",
  body:
    "The market news context is a rotation narrative, not a trade signal. Flows are clustering around decentralized compute, rendering, and AI-adjacent infrastructure.",
  category: "narrative_shift",
  status: "published",
  symbols: ["TAO", "RNDR", "AKT"],
  confidence: 88,
  imagePrompt: null,
  imageUrl: null,
  generatedTweetText: null,
  generatedBlogPost: null,
  generatorLogMessage: null,
  generatorPayload: {},
  sources: [
    { label: "Market feed", url: "https://example.com/market-feed", provider: "news" },
    { label: "Social scan", url: "https://example.com/social-scan", provider: "twitterapi" },
  ],
  proofRefIds: intelProofs.map((proof) => proof.id),
  publishedAt: "2026-04-25T09:04:20.000Z",
  createdAt: "2026-04-25T09:03:20.000Z",
  updatedAt: "2026-04-25T09:04:20.000Z",
});

const makeAxlMessages = (runId: string) =>
  ["mcp", "a2a", "send"].map((transportKind, index) =>
    axlEnvelopeSchema.parse({
      id: `axl-${runId}-${index + 1}`,
      runId,
      correlationId: `corr-${runId}`,
      fromAgentId: "agent-orchestrator-001",
      fromRole: "orchestrator",
      toAgentId: index === 2 ? null : "agent-research-001",
      toRole: index === 2 ? null : "research",
      topic: null,
      messageType: "agent.request",
      payload: { index },
      transportKind,
      deliveryStatus: "received",
      durableRefId: null,
      timestamp: index === 0 ? signalStartedAt : intelStartedAt,
    }),
  );

const makeEvent = (input: {
  id: string;
  runId: string;
  agentRole: string;
  eventType: string;
  summary: string;
  timestamp: string;
  proofRefId?: string | null;
  signalId?: string | null;
  intelId?: string | null;
}) =>
  agentEventSchema.parse({
    id: input.id,
    runId: input.runId,
    agentId: `agent-${input.agentRole}-001`,
    agentRole: input.agentRole,
    eventType: input.eventType,
    status: "success",
    summary: input.summary,
    payload: { provider: input.eventType === "report_published" ? "twitterapi" : "runtime" },
    timestamp: input.timestamp,
    correlationId: `corr-${input.runId}`,
    axlMessageId: null,
    proofRefId: input.proofRefId ?? null,
    signalId: input.signalId ?? null,
    intelId: input.intelId ?? null,
  });

const signalEvents = [
  makeEvent({
    id: "event-signal-001",
    runId: signalRun.id,
    agentRole: "orchestrator",
    eventType: "run_created",
    summary: "Scheduled live signal run created.",
    timestamp: signalStartedAt,
  }),
  makeEvent({
    id: "event-signal-002",
    runId: signalRun.id,
    agentRole: "scanner",
    eventType: "candidate_found",
    summary: "Candidate found.",
    timestamp: "2026-04-25T08:01:00.000Z",
  }),
  makeEvent({
    id: "event-signal-003",
    runId: signalRun.id,
    agentRole: "critic",
    eventType: "critic_decision",
    summary: "Critic approved signal.",
    timestamp: "2026-04-25T08:05:30.000Z",
    proofRefId: "proof-signal-compute-001",
    signalId: signalRecord.id,
  }),
  makeEvent({
    id: "event-signal-004",
    runId: signalRun.id,
    agentRole: "publisher",
    eventType: "report_published",
    summary: "Signal report published.",
    timestamp: "2026-04-25T08:06:10.000Z",
    proofRefId: "proof-signal-post-001",
    signalId: signalRecord.id,
  }),
  makeEvent({
    id: "event-signal-005",
    runId: signalRun.id,
    agentRole: "memory",
    eventType: "zero_g_file_published",
    summary: "Signal manifest published.",
    timestamp: "2026-04-25T08:06:20.000Z",
    proofRefId: "proof-signal-manifest-001",
    signalId: signalRecord.id,
  }),
];

const intelEvents = [
  makeEvent({
    id: "event-intel-001",
    runId: intelRun.id,
    agentRole: "orchestrator",
    eventType: "run_created",
    summary: "Scheduled live intel run created.",
    timestamp: intelStartedAt,
  }),
  makeEvent({
    id: "event-intel-002",
    runId: intelRun.id,
    agentRole: "analyst",
    eventType: "intel_ready",
    summary: "Intel report ready.",
    timestamp: "2026-04-25T09:03:20.000Z",
    proofRefId: "proof-intel-kv-001",
    intelId: intelRecord.id,
  }),
  makeEvent({
    id: "event-intel-003",
    runId: intelRun.id,
    agentRole: "publisher",
    eventType: "post_queued",
    summary: "Intel post queued.",
    timestamp: "2026-04-25T09:04:05.000Z",
    intelId: intelRecord.id,
  }),
  makeEvent({
    id: "event-intel-004",
    runId: intelRun.id,
    agentRole: "publisher",
    eventType: "report_published",
    summary: "Intel report published.",
    timestamp: "2026-04-25T09:04:20.000Z",
    proofRefId: "proof-intel-post-001",
    intelId: intelRecord.id,
  }),
  makeEvent({
    id: "event-intel-005",
    runId: intelRun.id,
    agentRole: "memory",
    eventType: "zero_g_file_published",
    summary: "Intel manifest published.",
    timestamp: "2026-04-25T09:04:10.000Z",
    proofRefId: "proof-intel-manifest-001",
    intelId: intelRecord.id,
  }),
];

const signalPost = outboundPostSchema.parse({
  id: "post-signal-001",
  runId: signalRun.id,
  signalId: signalRecord.id,
  intelId: null,
  target: "x",
  kind: "signal_alert",
  status: "posted",
  payload: {
    text: "$BTC LONG day trade\nconf: 91%",
    thread: [],
    metadata: { manifestRefId: "proof-signal-manifest-001" },
  },
  provider: "twitterapi",
  providerPostId: "tweet-signal-001",
  publishedUrl: "https://x.com/omen/status/1000000000000000001",
  lastError: null,
  createdAt: "2026-04-25T08:06:00.000Z",
  updatedAt: "2026-04-25T08:06:10.000Z",
  publishedAt: "2026-04-25T08:06:10.000Z",
});

const intelPost = outboundPostSchema.parse({
  id: "post-intel-001",
  runId: intelRun.id,
  signalId: null,
  intelId: intelRecord.id,
  target: "x",
  kind: "intel_summary",
  status: "posted",
  payload: {
    text: "Omen intel: ai infrastructure rotation is building market attention.",
    thread: [],
    metadata: { manifestRefId: "proof-intel-manifest-001" },
  },
  provider: "twitterapi",
  providerPostId: "tweet-intel-001",
  publishedUrl: "https://x.com/omen/status/1000000000000000002",
  lastError: null,
  createdAt: "2026-04-25T09:04:00.000Z",
  updatedAt: "2026-04-25T09:04:20.000Z",
  publishedAt: "2026-04-25T09:04:20.000Z",
});

export const demoSignalRunBundle = {
  run: signalRun,
  signal: signalRecord,
  intel: null,
  proofs: signalProofs,
  proofBundle: runProofBundleSchema.parse({
    runId: signalRun.id,
    manifestRefId: "proof-signal-manifest-001",
    artifactRefs: signalProofs,
  }),
  outboundPosts: [signalPost],
  nodes: demoAgentNodes,
  axlMessages: makeAxlMessages(signalRun.id),
  events: signalEvents,
};

export const demoIntelRunBundle = {
  run: intelRun,
  signal: null,
  intel: intelRecord,
  proofs: intelProofs,
  proofBundle: runProofBundleSchema.parse({
    runId: intelRun.id,
    manifestRefId: "proof-intel-manifest-001",
    artifactRefs: intelProofs,
  }),
  outboundPosts: [intelPost],
  nodes: demoAgentNodes,
  axlMessages: makeAxlMessages(intelRun.id),
  events: intelEvents,
};

export const demoRunBundles = [demoSignalRunBundle, demoIntelRunBundle];

export const demoAnalyticsSnapshots = [
  analyticsSnapshotSchema.parse({
    id: "analytics-snapshot-001",
    runId: signalRun.id,
    generatedAt: "2026-04-25T08:06:15.000Z",
    totals: {
      totalRuns: 1,
      completedRuns: 1,
      publishedSignals: 1,
      publishedIntel: 0,
      activeSignals: 0,
      closedSignals: 1,
      winningSignals: 1,
      losingSignals: 0,
      totalPnlPercent: 2.21,
      averageR: 2.21,
    },
    confidenceBands: [{ label: "90-94", value: 1 }],
    tokenFrequency: [{ label: "BTC", value: 1 }],
    mindshare: [{ label: "BTC", value: 100 }],
    winRate: 100,
  }),
  analyticsSnapshotSchema.parse({
    id: "analytics-snapshot-002",
    runId: intelRun.id,
    generatedAt: "2026-04-25T09:04:25.000Z",
    totals: {
      totalRuns: 2,
      completedRuns: 2,
      publishedSignals: 1,
      publishedIntel: 1,
      activeSignals: 0,
      closedSignals: 1,
      winningSignals: 1,
      losingSignals: 0,
      totalPnlPercent: 2.21,
      averageR: 2.21,
    },
    confidenceBands: [
      { label: "85-89", value: 1 },
      { label: "90-94", value: 1 },
    ],
    tokenFrequency: [
      { label: "AKT", value: 1 },
      { label: "BTC", value: 1 },
      { label: "RNDR", value: 1 },
      { label: "TAO", value: 1 },
    ],
    mindshare: [
      { label: "AKT", value: 25 },
      { label: "BTC", value: 25 },
      { label: "RNDR", value: 25 },
      { label: "TAO", value: 25 },
    ],
    winRate: 100,
  }),
];

export const demoDashboardSummary = dashboardSummarySchema.parse({
  activeRun: null,
  latestRun: intelRun,
  latestSignalId: signalRecord.id,
  latestIntelId: intelRecord.id,
  scheduler: demoSchedulerStatus,
  latestPost: intelPost,
  analytics: demoAnalyticsSnapshots[1],
});
