import { randomUUID } from "node:crypto";

import {
  createOmenGraphFactory,
  type GraphFactory,
  type SwarmCheckpoint,
  type SwarmCheckpointStore,
  type SwarmState,
} from "@omen/agents";
import { AxlHttpNodeAdapter, toAxlPeerStatuses } from "@omen/axl";
import {
  AgentEventsRepository,
  AgentNodesRepository,
  AnalyticsSnapshotsRepository,
  AxlMessagesRepository,
  IntelsRepository,
  OutboundPostsRepository,
  RunsRepository,
  SignalsRepository,
  ZeroGRefsRepository,
  createSupabaseServiceRoleClient,
} from "@omen/db";
import {
  ZeroGLogStore,
  ZeroGStateStore,
  type ZeroGAdapterConfig,
  ZeroGClientAdapter,
  ZeroGProofAnchor,
} from "@omen/zero-g";
import { TRADEABLE_SYMBOLS } from "@omen/shared";
import type {
  AgentEvent,
  AgentEventType,
  AgentNode,
  AgentRole,
  AxlEnvelope,
  EventStatus,
  Intel,
  Signal,
  ProofArtifact,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import { createLogger, type Logger } from "../bootstrap/logger.js";
import { AxlNodeManager } from "../nodes/axl-node-manager.js";
import { AxlPeerRegistry } from "../nodes/axl-peer-registry.js";
import { EventPublisher } from "../publishers/event-publisher.js";
import { EvidenceBundlePublisher } from "../publishers/evidence-bundle-publisher.js";
import { ReportBundlePublisher } from "../publishers/report-bundle-publisher.js";
import { RunManifestPublisher } from "../publishers/run-manifest-publisher.js";
import { PostProofPublisher } from "../publishers/post-proof-publisher.js";
import { PostPublisher } from "../publishers/post-publisher.js";
import { PostResultRecorder } from "../publishers/post-result-recorder.js";
import { ZeroGPublisher } from "../publishers/zero-g-publisher.js";
import { AxlMessageRecorder } from "../publishers/axl-message-recorder.js";
import { ZeroGRefRecorder } from "../publishers/zero-g-ref-recorder.js";
import { hasIntelImageConfig, IntelImageService } from "../services/intel-image-service.js";
import { TelegramService } from "../services/telegram-service.js";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler.js";

const DEFAULT_MARKET_UNIVERSE = TRADEABLE_SYMBOLS;
const DEFAULT_SCAN_INTERVAL_MINUTES = 60;
const ZERO_G_MILESTONE_CHECKPOINT_STEPS = new Set(["memory-agent", "publisher-agent"]);

const managedStepRoleMap = {
  "market-bias-agent": "market_bias",
  "scanner-agent": "scanner",
  "research-agent": "research",
  "chart-vision-agent": "chart_vision",
  "analyst-agent": "analyst",
  "intel-agent": "intel",
  "generator-agent": "generator",
  "writer-agent": "writer",
  "memory-agent": "memory",
  "publisher-agent": "publisher",
} as const satisfies Record<string, AgentRole>;

const stepEventTypeMap = {
  "market-bias-agent": "market_bias_generated",
  "scanner-agent": "candidate_found",
  "research-agent": "research_completed",
  "chart-vision-agent": "chart_generated",
  "analyst-agent": "thesis_generated",
  "intel-agent": "intel_ready",
  "generator-agent": "intel_ready",
  "writer-agent": "intel_ready",
  "memory-agent": "zero_g_kv_write",
  "publisher-agent": "report_published",
} as const satisfies Record<string, AgentEventType>;

const axlStepRoleMap = {
  "scanner-agent": "scanner",
  "research-agent": "research",
  "analyst-agent": "analyst",
} as const;

const axlHealthMethodByRole = {
  scanner: "scan.health",
  research: "research.health",
  analyst: "analyst.health",
} as const;

const defaultAxlServiceByRole: Record<Exclude<AgentRole, "monitor">, string> = {
  orchestrator: "orchestrator",
  market_bias: "market_bias",
  scanner: "scanner",
  research: "research",
  chart_vision: "chart_vision",
  analyst: "analyst",
  critic: "critic",
  intel: "intel",
  generator: "generator",
  writer: "writer",
  publisher: "publisher",
  memory: "memory",
};

const resolveAxlNodePeerId = (
  nodes: BackendEnv["axl"]["nodes"],
  role: Exclude<AgentRole, "monitor">,
) => {
  switch (role) {
    case "orchestrator":
      return nodes.orchestrator;
    case "market_bias":
      return nodes.marketBias;
    case "scanner":
      return nodes.scanner;
    case "research":
      return nodes.research;
    case "chart_vision":
      return nodes.chartVision;
    case "analyst":
      return nodes.analyst;
    case "critic":
      return nodes.critic;
    case "intel":
      return nodes.intel;
    case "generator":
      return nodes.generator;
    case "writer":
      return nodes.writer;
    case "publisher":
      return nodes.publisher;
    case "memory":
      return nodes.memory;
  }
};

const getRoleForStep = (step: string): AgentRole =>
  managedStepRoleMap[step as keyof typeof managedStepRoleMap] ?? "monitor";

const getEventTypeForStep = (step: string): AgentEventType =>
  stepEventTypeMap[step as keyof typeof stepEventTypeMap] ?? "warning";

const hasTwitterPostingConfig = (env: BackendEnv) =>
  Boolean(env.twitterApi.apiKey && env.twitterApi.proxy);

const hasSupabasePersistenceConfig = (env: BackendEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const hasAxlTransportConfig = (env: BackendEnv) => Boolean(env.axl.nodeBaseUrl);

const hasConfiguredAxlServicePeer = (env: BackendEnv) => Boolean(env.axl.servicePeerId?.trim());

const hasZeroGStorageConfig = (env: BackendEnv) =>
  Boolean(env.zeroG.indexerUrl && env.zeroG.rpcUrl && env.zeroG.privateKey);

const hasZeroGComputeConfig = (env: BackendEnv) =>
  Boolean(env.zeroG.computeUrl && env.zeroG.computeApiKey);

const toPersistableLinkedRecordIds = () => ({
  signalId: null as string | null,
  intelId: null as string | null,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const deriveManifestAnchorRoot = (artifact: ProofArtifact) => {
  const rootHashHint = artifact.metadata.rootHashHint;

  if (typeof rootHashHint === "string" && rootHashHint.trim()) {
    return rootHashHint;
  }

  return artifact.locator || artifact.key || artifact.id;
};

const escapePromptRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceImagePromptSymbolMentions = (value: string, symbols: readonly string[]) =>
  symbols.reduce(
    (result, symbol) =>
      result.replace(
        new RegExp(`\\$?\\b${escapePromptRegExp(symbol.replace(/^\$/, ""))}\\b`, "gi"),
        "an unmarked digital asset",
      ),
    value,
  );

const buildIntelImagePrompt = (report: SwarmState["intelReports"][number]) =>
  report.imagePrompt ??
  [
    "strictly visual-only full-bleed scene with no title card, no banner, no header strip, no lower third, no text panel, no article layout, no news card, no readable or pseudo-readable text",
    "single cinematic abstract market-intelligence illustration, not a poster, not an infographic, not a presentation slide, not a webpage, not an article thumbnail",
    `depict ${replaceImagePromptSymbolMentions(report.title, report.symbols)
      .replace(/\$[A-Za-z0-9_]+/g, "an unmarked digital asset")
      .toLowerCase()} as visual metaphor only`,
    `the scene should be driven by ${replaceImagePromptSymbolMentions(
      report.summary || report.insight,
      report.symbols,
    )
      .replace(/\$[A-Za-z0-9_]+/g, "an unmarked digital asset")
      .slice(0, 180)
      .toLowerCase()}`,
    report.symbols.length > 0
      ? "depict the specific named-asset thesis as unmarked color-coded asset forms, directional liquidity streams, protocol-scale architecture, wallet-node clusters, and risk/attention pressure matching the report"
      : "depict the specific market thesis through macro pressure, liquidity depth, narrative attention, and risk rotation matching the report",
    report.symbols.length > 0
      ? "abstract representations of the tracked crypto assets through color-coded liquidity flows, geometric forms, and market structure, with every surface blank and unmarked"
      : "broad crypto market narrative represented through institutional liquidity, macro pressure, and social signal flows, with every surface blank and unmarked",
    `market category mood is ${report.category.replace(/_/g, " ")}`,
    "cinematic institutional research environment, abstract market flows as light trails and geometric depth",
    "sharp focus, high contrast, 16:9",
    "no words, no letters, no numbers, no captions, no labels, no logos, no brand marks, no watermarks, no signatures, no ticker symbols, no charts with axes or legends, no dashboard UI, no screens, no monitors, no terminal windows, no documents, no posters, no signs, no coins with markings",
  ].join(", ");

const buildZeroGAdapterConfig = (env: BackendEnv): ZeroGAdapterConfig | null => {
  if (!env.zeroG.indexerUrl) {
    return null;
  }

  return {
    storage: {
      indexerUrl: env.zeroG.indexerUrl,
      evmRpcUrl: env.zeroG.rpcUrl ?? undefined,
      kvNodeUrl: env.zeroG.kvNodeUrl ?? undefined,
      privateKey: env.zeroG.privateKey ?? undefined,
      flowContractAddress: env.zeroG.flowContractAddress ?? undefined,
      expectedReplica: 1,
      namespaceSeed: "omen-zero-g-kv-v1",
      requestTimeoutMs: 60_000,
    },
    log: {
      baseUrl: env.zeroG.indexerUrl,
      evmRpcUrl: env.zeroG.rpcUrl ?? undefined,
      privateKey: env.zeroG.privateKey ?? undefined,
      expectedReplica: 1,
      requestTimeoutMs: 60_000,
    },
    compute: env.zeroG.computeUrl
      ? {
          baseUrl: env.zeroG.computeUrl,
          apiKey: env.zeroG.computeApiKey ?? undefined,
          requestTimeoutMs: 60_000,
        }
      : undefined,
    chain:
      env.zeroG.rpcUrl && env.zeroG.privateKey
        ? {
            rpcUrl: env.zeroG.rpcUrl,
            chainId: env.zeroG.chainId,
            privateKey: env.zeroG.privateKey,
            explorerBaseUrl: env.zeroG.chainExplorerBaseUrl ?? undefined,
          }
        : undefined,
  };
};

const createLiveRuntimeConfig = (input: {
  env: BackendEnv;
  request: SchedulerTaskContext;
  marketUniverse: string[];
  scanIntervalMinutes: number;
  postToXEnabledOverride?: boolean;
}): SwarmState["config"] => {
  const externalReadsEnabled = input.request.mode.allowsExternalReads;
  const postToXEnabled =
    (input.postToXEnabledOverride ?? true) &&
    input.request.mode.allowsExternalWrites &&
    hasTwitterPostingConfig(input.env);

  return {
    id: "live-swarm-runtime",
    mode: input.request.mode.mode,
    marketUniverse: input.marketUniverse,
    qualityThresholds: {
      minConfidence: 85,
      minRiskReward: 2,
      minConfluences: 2,
    },
    providers: {
      axl: { enabled: hasAxlTransportConfig(input.env), required: false },
      zeroGStorage: { enabled: hasZeroGStorageConfig(input.env), required: false },
      zeroGCompute: { enabled: hasZeroGComputeConfig(input.env), required: false },
      binance: { enabled: externalReadsEnabled, required: false },
      coinGecko: { enabled: externalReadsEnabled, required: false },
      defiLlama: { enabled: externalReadsEnabled, required: false },
      news: { enabled: false, required: false },
      twitterapi: {
        enabled: postToXEnabled,
        required: false,
      },
    },
    paperTradingEnabled: true,
    testnetExecutionEnabled: false,
    mainnetExecutionEnabled: false,
    postToXEnabled,
    scanIntervalMinutes: input.scanIntervalMinutes,
    updatedAt: new Date().toISOString(),
  };
};

const createScheduledRun = (input: SchedulerTaskContext): SwarmState["run"] => ({
  id: input.runId,
  mode: input.mode.mode,
  status: "starting",
  marketBias: "UNKNOWN",
  startedAt: null,
  completedAt: null,
  triggeredBy: input.trigger === "interval" ? "scheduler" : "system",
  activeCandidateCount: 0,
  currentCheckpointRefId: null,
  finalSignalId: null,
  finalIntelId: null,
  failureReason: null,
  outcome: null,
  configSnapshot: {
    runtimeMode: input.mode.mode,
    schedulerLabel: input.mode.label,
    triggeredAt: input.triggeredAt,
  },
  createdAt: input.triggeredAt,
  updatedAt: input.triggeredAt,
});

const toRuntimeEnvironment = (mode: SchedulerTaskContext["mode"]["mode"]) =>
  mode.replace(/_/g, "-");

const summarizeCheckpoint = (checkpoint: SwarmCheckpoint) => {
  const role = getRoleForStep(checkpoint.step);

  switch (checkpoint.step) {
    case "market-bias-agent":
      return `Market bias resolved to ${checkpoint.state.run.marketBias}.`;
    case "scanner-agent":
      return `Scanner retained ${checkpoint.state.activeCandidates.length.toString()} active candidate(s).`;
    case "research-agent":
      return `Research assembled ${checkpoint.state.evidenceItems.length.toString()} evidence item(s).`;
    case "chart-vision-agent":
      return `Chart vision generated ${checkpoint.state.chartVisionSummaries.length.toString()} chart summary item(s).`;
    case "analyst-agent":
      return `Analyst drafted ${checkpoint.state.thesisDrafts.length.toString()} thesis item(s) and applied the quality gate.`;
    case "critic-agent": {
      const review = checkpoint.state.criticReviews.at(-1);
      return review
        ? `Legacy critic decision: ${review.decision}.`
        : "Legacy critic checkpoint completed without a persisted review.";
    }
    case "intel-agent": {
      const intelReport = checkpoint.state.intelReports.at(-1);
      return intelReport
        ? `Intel report ready: ${intelReport.title}.`
        : "Intel stage completed without a publishable report.";
    }
    case "memory-agent":
      return `Checkpoint persisted as ${checkpoint.state.latestCheckpointRefId ?? "unbound"}.`;
    case "publisher-agent":
      return `Publisher completed with outcome ${checkpoint.state.run.outcome?.outcomeType ?? "no_conviction"}.`;
    default:
      return `${role} checkpoint completed.`;
  }
};

const createAgentNode = (input: {
  step: string;
  timestamp: string;
  peerId?: string | null;
}): AgentNode => {
  const role = getRoleForStep(input.step);
  const transport = input.peerId ? "axl" : "local";

  return {
    id: `agent-${input.step}`,
    role,
    transport,
    status: "online",
    peerId: input.peerId ?? null,
    lastHeartbeatAt: input.timestamp,
    lastError: null,
    metadata: {
      step: input.step,
      managedBy: "live-swarm-pipeline",
      services: role === "monitor" ? [] : [defaultAxlServiceByRole[role]],
    },
  };
};

const createOrchestratorNode = (input: {
  timestamp: string;
  peerId?: string | null;
}): AgentNode => ({
  id: "agent-orchestrator",
  role: "orchestrator",
  transport: input.peerId ? "axl" : "local",
  status: "online",
  peerId: input.peerId ?? null,
  lastHeartbeatAt: input.timestamp,
  lastError: null,
  metadata: {
    managedBy: "live-swarm-pipeline",
    step: "orchestrator",
    services: [defaultAxlServiceByRole.orchestrator],
  },
});

const createPublisherNode = (input: { timestamp: string; peerId?: string | null }): AgentNode => ({
  id: "agent-publisher",
  role: "publisher",
  transport: input.peerId ? "axl" : "local",
  status: "online",
  peerId: input.peerId ?? null,
  lastHeartbeatAt: input.timestamp,
  lastError: null,
  metadata: {
    managedBy: "live-swarm-pipeline",
    step: "publisher-agent",
    services: [defaultAxlServiceByRole.publisher],
  },
});

const createAgentEvent = (input: {
  checkpoint: SwarmCheckpoint;
  timestamp: string;
  status: EventStatus;
  summary: string;
  proofRefId?: string | null;
  axlMessageId?: string | null;
  payload?: Record<string, unknown>;
  signalId?: string | null;
  intelId?: string | null;
}): AgentEvent => ({
  id: `event-${randomUUID()}`,
  runId: input.checkpoint.runId,
  agentId: `agent-${input.checkpoint.step}`,
  agentRole: getRoleForStep(input.checkpoint.step),
  eventType: getEventTypeForStep(input.checkpoint.step),
  status: input.status,
  summary: input.summary,
  payload: {
    checkpointId: input.checkpoint.checkpointId,
    step: input.checkpoint.step,
    runStatus: input.checkpoint.state.run.status,
    outcomeType: input.checkpoint.state.run.outcome?.outcomeType ?? null,
    ...input.payload,
  },
  timestamp: input.timestamp,
  correlationId: `${input.checkpoint.runId}:${input.checkpoint.step}`,
  axlMessageId: input.axlMessageId ?? null,
  proofRefId: input.proofRefId ?? null,
  signalId:
    input.signalId !== undefined ? input.signalId : input.checkpoint.state.run.finalSignalId,
  intelId: input.intelId !== undefined ? input.intelId : input.checkpoint.state.run.finalIntelId,
});

const createRunLifecycleEvent = (input: {
  runId: string;
  timestamp: string;
  summary: string;
  status: EventStatus;
  payload?: Record<string, unknown>;
}): AgentEvent => ({
  id: `event-${randomUUID()}`,
  runId: input.runId,
  agentId: "agent-orchestrator",
  agentRole: "orchestrator",
  eventType: "run_created",
  status: input.status,
  summary: input.summary,
  payload: input.payload ?? {},
  timestamp: input.timestamp,
  correlationId: `${input.runId}:orchestrator`,
  axlMessageId: null,
  proofRefId: null,
  signalId: null,
  intelId: null,
});

const createAxlEnvelopeForCheckpoint = (input: {
  checkpoint: SwarmCheckpoint;
  timestamp: string;
  toRole: (typeof axlStepRoleMap)[keyof typeof axlStepRoleMap];
  toAgentId: string;
  durableRefId?: string | null;
}): AxlEnvelope => ({
  id: `axl-${randomUUID()}`,
  runId: input.checkpoint.runId,
  correlationId: `${input.checkpoint.runId}:${input.checkpoint.step}`,
  fromAgentId: "agent-orchestrator",
  fromRole: "orchestrator",
  toAgentId: input.toAgentId,
  toRole: input.toRole,
  topic: "swarm.checkpoint",
  messageType: `${input.checkpoint.step}.completed`,
  payload: {
    checkpointId: input.checkpoint.checkpointId,
    step: input.checkpoint.step,
    summary: summarizeCheckpoint(input.checkpoint),
    runStatus: input.checkpoint.state.run.status,
    stateDelta: input.checkpoint.stateDelta,
  },
  transportKind: "send",
  deliveryStatus: "queued",
  durableRefId: input.durableRefId ?? null,
  timestamp: input.timestamp,
});

const createServiceRoleClientFromEnv = (env: BackendEnv) => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return null;
  }

  return createSupabaseServiceRoleClient({
    url: env.supabase.url,
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
    serviceRoleKey: env.supabase.serviceRoleKey,
    schema: env.supabase.schema,
  });
};

class LivePipelineExecutionContext {
  private readonly environment: string;

  private readonly runsRepository: RunsRepository | null;

  private readonly intelsRepository: IntelsRepository | null;

  private readonly signalsRepository: SignalsRepository | null;

  private readonly outboundPostsRepository: OutboundPostsRepository | null;

  private readonly agentEventsRepository: AgentEventsRepository | null;

  private readonly eventPublisher: EventPublisher | null;

  private readonly axlMessageRecorder: AxlMessageRecorder | null;

  private readonly zeroGRefRecorder: ZeroGRefRecorder | null;

  private readonly axlNodeManager: AxlNodeManager | null;

  private readonly axlPeerRegistry: AxlPeerRegistry | null;

  private readonly axlAdapter: AxlHttpNodeAdapter | null;

  private readonly zeroGPublisher: ZeroGPublisher | null;

  private readonly zeroGStateStore: ZeroGStateStore | null;

  private readonly zeroGLogStore: ZeroGLogStore | null;

  private readonly evidenceBundlePublisher: EvidenceBundlePublisher | null;

  private readonly reportBundlePublisher: ReportBundlePublisher | null;

  private readonly runManifestPublisher: RunManifestPublisher | null;

  private readonly zeroGProofAnchor: ZeroGProofAnchor | null;

  private readonly postProofPublisher: PostProofPublisher | null;

  private readonly postPublisher: PostPublisher | null;

  private readonly postResultRecorder: PostResultRecorder | null;

  private readonly telegramService: TelegramService;

  private axlTransportAvailable = false;

  private axlServicePeerId: string | null = null;

  private readonly artifacts: ProofArtifact[] = [];

  private readonly logger: Logger;

  private readonly intelImageService: IntelImageService | null;

  constructor(
    private readonly input: {
      env: BackendEnv;
      request: SchedulerTaskContext;
      config: SwarmState["config"];
    },
  ) {
    this.environment = toRuntimeEnvironment(input.request.mode.mode);
    this.logger = createLogger(input.env);

    const supabaseClient = hasSupabasePersistenceConfig(input.env)
      ? createServiceRoleClientFromEnv(input.env)
      : null;
    const runsRepository = supabaseClient ? new RunsRepository(supabaseClient) : null;
    const intelsRepository = supabaseClient ? new IntelsRepository(supabaseClient) : null;
    const signalsRepository = supabaseClient ? new SignalsRepository(supabaseClient) : null;
    const outboundPostsRepository = supabaseClient
      ? new OutboundPostsRepository(supabaseClient)
      : null;
    const agentEventsRepository = supabaseClient ? new AgentEventsRepository(supabaseClient) : null;

    this.runsRepository = runsRepository;
    this.intelsRepository = intelsRepository;
    this.signalsRepository = signalsRepository;
    this.outboundPostsRepository = outboundPostsRepository;
    this.agentEventsRepository = agentEventsRepository;
    this.postPublisher = outboundPostsRepository
      ? new PostPublisher({
          env: input.env,
          posts: outboundPostsRepository,
          logger: this.logger,
        })
      : null;
    this.postResultRecorder = new PostResultRecorder({
      runs: runsRepository,
      analytics: supabaseClient ? new AnalyticsSnapshotsRepository(supabaseClient) : null,
    });
    this.telegramService = new TelegramService({
      env: input.env,
      logger: this.logger,
    });
    this.eventPublisher =
      supabaseClient && agentEventsRepository
        ? new EventPublisher({
            events: agentEventsRepository,
            nodes: new AgentNodesRepository(supabaseClient),
          })
        : null;
    this.axlMessageRecorder = supabaseClient
      ? new AxlMessageRecorder(new AxlMessagesRepository(supabaseClient))
      : null;
    this.zeroGRefRecorder = supabaseClient
      ? new ZeroGRefRecorder(new ZeroGRefsRepository(supabaseClient))
      : null;
    this.intelImageService = hasIntelImageConfig(input.env)
      ? new IntelImageService({ env: input.env, logger: this.logger })
      : null;

    if (hasAxlTransportConfig(input.env)) {
      this.axlAdapter = new AxlHttpNodeAdapter({
        node: {
          baseUrl: input.env.axl.nodeBaseUrl,
          requestTimeoutMs: input.env.axl.requestTimeoutMs,
          defaultHeaders: input.env.axl.apiToken
            ? {
                Authorization: `Bearer ${input.env.axl.apiToken}`,
              }
            : {},
        },
      });
      this.axlPeerRegistry = new AxlPeerRegistry();
      this.axlNodeManager = new AxlNodeManager({
        adapter: this.axlAdapter,
        peerRegistry: this.axlPeerRegistry,
        orchestratorPeerId: input.env.axl.nodes.orchestrator,
        peerIdsByRole: {
          orchestrator: input.env.axl.nodes.orchestrator,
          market_bias: input.env.axl.nodes.marketBias,
          scanner: input.env.axl.nodes.scanner,
          research: input.env.axl.nodes.research,
          chart_vision: input.env.axl.nodes.chartVision,
          analyst: input.env.axl.nodes.analyst,
          critic: input.env.axl.nodes.critic,
          intel: input.env.axl.nodes.intel,
          generator: input.env.axl.nodes.generator,
          writer: input.env.axl.nodes.writer,
          publisher: input.env.axl.nodes.publisher,
          memory: input.env.axl.nodes.memory,
        },
      });
    } else {
      this.axlAdapter = null;
      this.axlPeerRegistry = null;
      this.axlNodeManager = null;
    }

    const zeroGConfig = buildZeroGAdapterConfig(input.env);

    if (zeroGConfig) {
      const adapter = new ZeroGClientAdapter(zeroGConfig);
      this.zeroGStateStore = new ZeroGStateStore(adapter);
      this.zeroGLogStore = new ZeroGLogStore(adapter);
      this.zeroGPublisher = new ZeroGPublisher(zeroGConfig);
      this.evidenceBundlePublisher = new EvidenceBundlePublisher(zeroGConfig);
      this.reportBundlePublisher = new ReportBundlePublisher(zeroGConfig);
      this.runManifestPublisher = new RunManifestPublisher(zeroGConfig);
      this.zeroGProofAnchor = new ZeroGProofAnchor(zeroGConfig.chain);
      this.postProofPublisher = new PostProofPublisher(zeroGConfig);
    } else {
      this.zeroGStateStore = null;
      this.zeroGLogStore = null;
      this.zeroGPublisher = null;
      this.evidenceBundlePublisher = null;
      this.reportBundlePublisher = null;
      this.runManifestPublisher = null;
      this.zeroGProofAnchor = null;
      this.postProofPublisher = null;
    }
  }

  createCheckpointStore() {
    return new LivePipelineCheckpointStore(this);
  }

  async loadRecentIntelHistory(): Promise<SwarmState["recentIntelHistory"]> {
    if (!this.agentEventsRepository) {
      return [];
    }

    const recentEvents = await this.agentEventsRepository.listRecentByEventType({
      eventType: "intel_ready",
      limit: 25,
    });

    if (!recentEvents.ok) {
      throw new Error(`Failed to load recent intel history: ${recentEvents.error.message}`);
    }

    return recentEvents.value
      .map((event) => {
        const payload = event.payload;
        const title = typeof payload.title === "string" ? payload.title : null;
        const topic = typeof payload.topic === "string" ? payload.topic : null;
        const category = typeof payload.category === "string" ? payload.category : null;
        const symbols = Array.isArray(payload.symbols)
          ? payload.symbols.filter((value): value is string => typeof value === "string")
          : [];

        if (
          title === null ||
          topic === null ||
          (category !== "market_update" &&
            category !== "narrative_shift" &&
            category !== "token_watch" &&
            category !== "macro" &&
            category !== "opportunity")
        ) {
          return null;
        }

        return {
          title,
          topic,
          category,
          symbols,
          timestamp: event.timestamp,
        } satisfies SwarmState["recentIntelHistory"][number];
      })
      .filter((item): item is SwarmState["recentIntelHistory"][number] => item !== null);
  }

  async loadRecentPostContext(): Promise<SwarmState["recentPostContext"]> {
    if (!this.outboundPostsRepository) {
      return [];
    }

    const recentPosts = await this.outboundPostsRepository.listRecentPosts(25);

    if (!recentPosts.ok) {
      throw new Error(`Failed to load recent post context: ${recentPosts.error.message}`);
    }

    const context: SwarmState["recentPostContext"] = [];

    for (const post of recentPosts.value) {
      const text = post.payload.text.trim();

      if (text.length === 0) {
        continue;
      }

      context.push({
        kind: post.kind,
        text,
        status: post.status,
        publishedUrl: post.publishedUrl,
        signalId: post.signalId,
        intelId: post.intelId,
        timestamp: post.publishedAt ?? post.updatedAt,
      });
    }

    return context;
  }

  async loadActiveTradeSymbols(): Promise<SwarmState["activeTradeSymbols"]> {
    if (!this.signalsRepository) {
      return [];
    }

    const activeTradeSymbols = await this.signalsRepository.listActiveTradeSymbols();

    if (!activeTradeSymbols.ok) {
      throw new Error(`Failed to load active trade symbols: ${activeTradeSymbols.error.message}`);
    }

    return activeTradeSymbols.value;
  }

  async prepareRun(run: SwarmState["run"]) {
    await this.safePersistRun(run);

    if (this.eventPublisher) {
      await this.safePublishNodeStatus(
        createOrchestratorNode({
          timestamp: run.createdAt,
          peerId: this.input.env.axl.nodes.orchestrator,
        }),
      );
    }

    if (this.eventPublisher) {
      await this.safePublishEvent(
        createRunLifecycleEvent({
          runId: run.id,
          timestamp: run.createdAt,
          summary: "Scheduled live swarm run created.",
          status: "pending",
          payload: {
            mode: run.mode,
            configId: this.input.config.id,
          },
        }),
      );
    }

    if (this.axlNodeManager) {
      const registrations = this.axlNodeManager.registerDefaultLogicalNodes(run.createdAt);

      if (this.eventPublisher) {
        for (const registration of registrations) {
          await this.safePublishNodeStatus(registration.node);
        }
      }

      this.axlTransportAvailable = await this.probeAxlTransport(run.id, run.createdAt);
    }
  }

  async handleCheckpoint(checkpoint: SwarmCheckpoint) {
    const persisted = { ...checkpoint };
    const timestamp = checkpoint.createdAt;
    const stepSummary = summarizeCheckpoint(checkpoint);
    const peerId = this.resolvePeerIdForStep(checkpoint.step);
    const linkedRecordIds = toPersistableLinkedRecordIds();
    const shouldPublishZeroGCheckpoint =
      this.input.env.zeroG.checkpointStrategy === "all" ||
      ZERO_G_MILESTONE_CHECKPOINT_STEPS.has(checkpoint.step);

    if (this.zeroGStateStore && shouldPublishZeroGCheckpoint) {
      const checkpointArtifact = await this.tryPublishCheckpointState(persisted);

      if (checkpointArtifact) {
        persisted.durableRef = checkpointArtifact;
        persisted.state = {
          ...persisted.state,
          run: {
            ...persisted.state.run,
            currentCheckpointRefId: checkpointArtifact.id,
          },
          latestCheckpointRefId: checkpointArtifact.id,
        };

        if (this.zeroGLogStore) {
          await this.tryAppendCheckpointLog(persisted, stepSummary);
        }
      }
    }

    if (this.eventPublisher) {
      const latestIntel = persisted.state.intelReports.at(-1) ?? null;
      await this.safePublishNodeStatus(
        createAgentNode({
          step: checkpoint.step,
          timestamp,
          peerId,
        }),
      );
      await this.safePublishEvent(
        createAgentEvent({
          checkpoint: persisted,
          timestamp,
          status: "success",
          summary: stepSummary,
          proofRefId: persisted.durableRef?.id ?? null,
          payload: {
            activeCandidateCount: persisted.state.activeCandidates.length,
            evidenceCount: persisted.state.evidenceItems.length,
            ...(checkpoint.step === "intel-agent" && latestIntel
              ? {
                  title: latestIntel.title,
                  topic: latestIntel.topic,
                  category: latestIntel.category,
                  symbols: latestIntel.symbols,
                  importanceScore: latestIntel.importanceScore,
                }
              : {}),
          },
          signalId: linkedRecordIds.signalId,
          intelId: linkedRecordIds.intelId,
        }),
      );
    }

    if (this.axlTransportAvailable && checkpoint.step in axlStepRoleMap) {
      const toRole = axlStepRoleMap[checkpoint.step as keyof typeof axlStepRoleMap];
      const envelope: AxlEnvelope = {
        ...createAxlEnvelopeForCheckpoint({
          checkpoint: persisted,
          timestamp,
          toRole,
          toAgentId: `agent-${checkpoint.step}`,
          durableRefId: persisted.durableRef?.id ?? null,
        }),
        transportKind: "mcp",
      };
      const healthResult = await this.probeSpecialistService({
        checkpoint: persisted,
        toRole,
        timestamp,
      });
      const recordedEnvelope: AxlEnvelope = {
        ...envelope,
        deliveryStatus: healthResult.ok ? "sent" : "failed",
      };

      await this.safeRecordAxlMessage(recordedEnvelope);

      if (this.eventPublisher) {
        await this.safePublishEvent({
          id: `event-${randomUUID()}`,
          runId: persisted.runId,
          agentId: "agent-orchestrator",
          agentRole: "orchestrator",
          eventType: "axl_message_sent",
          status: healthResult.ok ? "success" : "warning",
          summary: healthResult.ok
            ? `AXL MCP route healthy for ${toRole}.`
            : `AXL MCP route failed for ${toRole}: ${healthResult.error.message}`,
          payload: {
            messageId: recordedEnvelope.id,
            toRole,
            deliveryStatus: recordedEnvelope.deliveryStatus,
            step: checkpoint.step,
            transportKind: recordedEnvelope.transportKind,
          },
          timestamp,
          correlationId: recordedEnvelope.correlationId,
          axlMessageId: recordedEnvelope.id,
          proofRefId: null,
          signalId: linkedRecordIds.signalId,
          intelId: linkedRecordIds.intelId,
        });
      }
    }

    return persisted;
  }

  async failRun(input: {
    fallbackRun: SwarmState["run"];
    checkpointStore: SwarmCheckpointStore;
    error: Error;
  }) {
    const checkpoints = await input.checkpointStore.listByRun(input.fallbackRun.id);
    const latestCheckpoint = checkpoints.at(-1) ?? null;
    const latestRun = latestCheckpoint?.state.run ?? input.fallbackRun;
    const timestamp = new Date().toISOString();
    const failedRun = this.toPersistableRun({
      ...latestRun,
      status: "failed",
      completedAt: timestamp,
      updatedAt: timestamp,
      failureReason: input.error.message,
      outcome: {
        outcomeType: "failed",
        summary: input.error.message,
        signalId: null,
        intelId: null,
      },
    });

    await this.safePersistRun(failedRun);

    if (this.eventPublisher) {
      await this.safePublishEvent(
        createRunLifecycleEvent({
          runId: failedRun.id,
          timestamp,
          summary: `Live swarm run failed: ${input.error.message}`,
          status: "error",
          payload: {
            finalStatus: failedRun.status,
            failureReason: failedRun.failureReason,
          },
        }),
      );
    }
  }

  async finalizeRun(finalState: SwarmState) {
    const persistedSignal = await this.safePersistFinalSignal(finalState);
    const persistedIntel = await this.safePersistFinalIntel(finalState);
    let persistedRun = this.toPersistableRun({
      ...finalState.run,
      finalSignalId: persistedSignal?.id ?? finalState.run.finalSignalId,
      finalIntelId: persistedIntel?.id ?? finalState.run.finalIntelId,
      outcome: finalState.run.outcome
        ? {
            ...finalState.run.outcome,
            signalId: persistedSignal?.id ?? finalState.run.outcome.signalId,
            intelId: persistedIntel?.id ?? finalState.run.outcome.intelId,
          }
        : null,
    });
    await this.safePersistRun(persistedRun);

    await this.safePublishTelegramPost({
      run: persistedRun,
      signal: persistedSignal,
      intel: persistedIntel,
    });

    const outboundPost = await this.safePublishOutboundPost({
      run: persistedRun,
      signal: persistedSignal,
      intel: persistedIntel,
    });

    if (outboundPost) {
      persistedRun = {
        ...persistedRun,
        outcome: persistedRun.outcome
          ? {
              ...persistedRun.outcome,
              postId: outboundPost.id,
              postStatus: outboundPost.status,
              publishedUrl: outboundPost.publishedUrl,
            }
          : null,
        updatedAt: outboundPost.updatedAt,
      };
      await this.safePersistRun(persistedRun);
    }

    if (this.zeroGPublisher) {
      const zeroGPublishResult = await this.safePublishFinalArtifacts({
        ...finalState,
        run: persistedRun,
      });
      const zeroGArtifacts = zeroGPublishResult.artifacts;

      const finalCheckpointArtifact = [...zeroGArtifacts]
        .reverse()
        .find((artifact) => artifact.refType === "kv_state");

      if (finalCheckpointArtifact) {
        persistedRun = {
          ...persistedRun,
          currentCheckpointRefId: finalCheckpointArtifact.id,
          updatedAt: new Date().toISOString(),
        };
        await this.safePersistRun(persistedRun);
      }

      if (zeroGArtifacts.length > 0 && this.eventPublisher) {
        await this.safePublishEvent(
          createRunLifecycleEvent({
            runId: finalState.run.id,
            timestamp: finalState.run.updatedAt,
            summary: `Published ${zeroGArtifacts.length.toString()} 0G artifact(s) for the completed run.`,
            status: "success",
            payload: {
              artifactCount: zeroGArtifacts.length,
              computeStatus: zeroGPublishResult.computeError ? "failed" : "ok",
              computeError: zeroGPublishResult.computeError,
            },
          }),
        );
      }

      if (zeroGPublishResult.computeError && this.eventPublisher) {
        await this.safePublishEvent(
          createRunLifecycleEvent({
            runId: finalState.run.id,
            timestamp: finalState.run.updatedAt,
            summary: `0G compute proof was not recorded: ${zeroGPublishResult.computeError}`,
            status: "warning",
            payload: {
              provider: "0g-compute",
              model: this.input.env.zeroG.computeModel,
              error: zeroGPublishResult.computeError,
            },
          }),
        );
      }
    }

    if (this.eventPublisher) {
      await this.safePublishEvent(
        createRunLifecycleEvent({
          runId: finalState.run.id,
          timestamp: finalState.run.updatedAt,
          summary: `Live swarm run completed with outcome ${finalState.run.outcome?.outcomeType ?? "no_conviction"}.`,
          status: "success",
          payload: {
            finalStatus: finalState.run.status,
            outcome: finalState.run.outcome,
          },
        }),
      );
    }
  }

  async listRecordedArtifacts() {
    return [...this.artifacts];
  }

  private async safePersistRun(run: SwarmState["run"]) {
    if (!this.runsRepository) {
      return;
    }

    const existing = await this.runsRepository.findRunById(run.id);

    if (!existing.ok) {
      throw new Error(`Failed to check run ${run.id}: ${existing.error.message}`);
    }

    const shouldUpdate = existing.value !== null;

    if (shouldUpdate) {
      const updated = await this.runsRepository.updateRun(run.id, run);

      if (!updated.ok) {
        throw new Error(`Failed to update run ${run.id}: ${updated.error.message}`);
      }

      return;
    }

    const created = await this.runsRepository.createRun(run);

    if (!created.ok) {
      if (created.error.code === "23505") {
        const updated = await this.runsRepository.updateRun(run.id, run);

        if (updated.ok) {
          return;
        }

        throw new Error(`Failed to update duplicate run ${run.id}: ${updated.error.message}`);
      }

      throw new Error(`Failed to create run ${run.id}: ${created.error.message}`);
    }
  }

  private async safePersistFinalIntel(finalState: SwarmState): Promise<Intel | null> {
    if (!this.intelsRepository || finalState.run.outcome?.outcomeType !== "intel") {
      return null;
    }

    const report = finalState.intelReports.at(-1);

    if (!report) {
      return null;
    }

    const intelId = finalState.run.finalIntelId ?? `intel-${finalState.run.id}`;
    const existing = await this.intelsRepository.findIntelById(intelId);

    if (!existing.ok) {
      throw new Error(`Failed to check intel ${intelId}: ${existing.error.message}`);
    }

    if (existing.value) {
      return existing.value;
    }

    const imagePrompt = buildIntelImagePrompt(report);
    const generatedContent = finalState.generatedIntelContents.at(-1) ?? null;
    const finalImagePrompt = generatedContent?.imagePrompt ?? imagePrompt;
    const imageUrl = this.intelImageService
      ? await this.intelImageService.generateAndStore(finalImagePrompt)
      : null;
    const timestamp = finalState.run.completedAt ?? new Date().toISOString();
    const article = finalState.intelArticles.at(-1) ?? null;
    const intel = {
      id: intelId,
      runId: finalState.run.id,
      title: article?.headline ?? generatedContent?.topic ?? report.title,
      slug: `${slugify(article?.headline ?? generatedContent?.topic ?? report.title) || "intel"}-${finalState.run.id.slice(0, 8)}`,
      summary: article?.tldr ?? report.summary,
      body: article?.content ?? generatedContent?.blogPost ?? report.insight,
      category: report.category,
      status: "published",
      symbols: report.symbols,
      confidence: report.confidence,
      imagePrompt: finalImagePrompt,
      imageUrl,
      generatedTweetText: generatedContent?.tweetText ?? null,
      generatedBlogPost: generatedContent?.blogPost ?? null,
      generatorLogMessage: generatedContent?.logMessage ?? null,
      generatorPayload: generatedContent ?? {},
      sources: [],
      proofRefIds: this.artifacts.map((artifact) => artifact.id),
      publishedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Intel;
    const created = await this.intelsRepository.createIntel(intel);

    if (!created.ok) {
      throw new Error(`Failed to create intel ${intel.id}: ${created.error.message}`);
    }

    return created.value;
  }

  private async safePersistFinalSignal(finalState: SwarmState): Promise<Signal | null> {
    if (!this.signalsRepository || finalState.run.outcome?.outcomeType !== "signal") {
      return null;
    }

    const thesis = finalState.thesisDrafts.at(-1);
    const review = finalState.criticReviews.at(-1);

    if (!thesis || review?.decision !== "approved") {
      return null;
    }

    const signalId = finalState.run.finalSignalId ?? `signal-${finalState.run.id}`;
    const existing = await this.signalsRepository.findSignalById(signalId);

    if (!existing.ok) {
      throw new Error(`Failed to check signal ${signalId}: ${existing.error.message}`);
    }

    if (existing.value) {
      return existing.value;
    }

    const timestamp = finalState.run.completedAt ?? new Date().toISOString();
    const signal = {
      id: signalId,
      runId: finalState.run.id,
      candidateId: thesis.candidateId,
      asset: thesis.asset,
      direction: thesis.direction,
      confidence: thesis.confidence,
      orderType: thesis.orderType,
      tradingStyle: thesis.tradingStyle,
      expectedDuration: thesis.expectedDuration,
      currentPrice: thesis.currentPrice,
      entryPrice: thesis.entryPrice,
      targetPrice: thesis.targetPrice,
      stopLoss: thesis.stopLoss,
      signalStatus: thesis.orderType === "limit" ? "pending" : "active",
      pnlPercent: null,
      closedAt: null,
      priceUpdatedAt: null,
      riskReward: thesis.riskReward,
      entryZone: thesis.entryPrice
        ? {
            low: thesis.entryPrice,
            high: thesis.entryPrice,
            rationale: "Publisher-approved thesis entry.",
          }
        : null,
      invalidation: thesis.stopLoss
        ? {
            low: thesis.stopLoss,
            high: thesis.stopLoss,
            rationale: "Analyst stop-loss invalidation.",
          }
        : null,
      targets: thesis.targetPrice ? [{ label: "TP1", price: thesis.targetPrice }] : [],
      whyNow: thesis.whyNow,
      confluences: thesis.confluences,
      uncertaintyNotes: thesis.uncertaintyNotes,
      missingDataNotes: thesis.missingDataNotes,
      criticDecision: review.decision,
      reportStatus: "published",
      finalReportRefId: null,
      proofRefIds: this.artifacts.map((artifact) => artifact.id),
      disclaimer:
        "Omen market intelligence is for informational purposes only and is not financial advice.",
      publishedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Signal;
    const created = await this.signalsRepository.createSignal(signal);

    if (!created.ok) {
      throw new Error(`Failed to create signal ${signal.id}: ${created.error.message}`);
    }

    return created.value;
  }

  private async safePublishOutboundPost(input: {
    run: SwarmState["run"];
    signal: Signal | null;
    intel: Intel | null;
  }) {
    if (!this.postPublisher || !this.input.config.postToXEnabled) {
      return null;
    }

    const result = input.signal
      ? await this.postPublisher.publishSignal(input.signal)
      : input.intel
        ? await this.postPublisher.publishIntel(input.intel)
        : null;

    if (!result) {
      return null;
    }

    await this.postResultRecorder?.recordPostResult({
      run: input.run,
      post: result.post,
    });

    if (this.postProofPublisher) {
      const proofArtifacts = await this.postProofPublisher.publish({
        environment: this.environment,
        post: result.post,
        providerResponse: result.providerResponse
          ? {
              provider: result.post.provider,
              providerPostId: result.post.providerPostId,
              publishedUrl: result.post.publishedUrl,
              raw: result.providerResponse,
            }
          : null,
      });

      for (const artifact of proofArtifacts) {
        await this.safeRecordArtifact(artifact);
      }
    }

    if (this.eventPublisher) {
      await this.safePublishNodeStatus(
        createPublisherNode({
          timestamp: result.post.updatedAt,
          peerId: this.input.env.axl.nodes.publisher,
        }),
      );
      await this.safePublishEvent({
        id: `event-${randomUUID()}`,
        runId: input.run.id,
        agentId: "agent-publisher",
        agentRole: "publisher",
        eventType: "post_queued",
        status: result.post.status === "posted" ? "success" : "warning",
        summary:
          result.post.status === "posted"
            ? "Outbound X post published through twitterapi."
            : `Outbound X post ended in ${result.post.status}.`,
        payload: {
          postId: result.post.id,
          provider: result.post.provider,
          status: result.post.status,
          publishedUrl: result.post.publishedUrl,
          lastError: result.post.lastError,
        },
        timestamp: result.post.updatedAt,
        correlationId: `${input.run.id}:post:${result.post.id}`,
        axlMessageId: null,
        proofRefId: null,
        signalId: result.post.signalId,
        intelId: result.post.intelId,
      });
    }

    return result.post;
  }

  private async safePublishTelegramPost(input: {
    run: SwarmState["run"];
    signal: Signal | null;
    intel: Intel | null;
  }) {
    const sent = input.signal
      ? await this.telegramService.sendSignal(input.signal)
      : input.intel
        ? await this.telegramService.sendIntel(input.intel)
        : false;

    if (!sent || !this.eventPublisher) {
      return;
    }

    const timestamp = new Date().toISOString();
    const linkedRecord = input.signal ?? input.intel;
    await this.safePublishEvent({
      id: `event-${randomUUID()}`,
      runId: input.run.id,
      agentId: "agent-publisher",
      agentRole: "publisher",
      eventType: "post_queued",
      status: "success",
      summary: `Outbound Telegram ${input.signal ? "signal" : "intel"} sent to channel.`,
      payload: {
        provider: "telegram",
        status: "posted",
        recordId: linkedRecord?.id ?? null,
      },
      timestamp,
      correlationId: `${input.run.id}:telegram:${linkedRecord?.id ?? "none"}`,
      axlMessageId: null,
      proofRefId: null,
      signalId: input.signal?.id ?? null,
      intelId: input.intel?.id ?? null,
    });
  }

  private async probeAxlTransport(runId: string, observedAt: string) {
    if (!this.axlNodeManager || !this.axlAdapter || !this.axlPeerRegistry) {
      return false;
    }

    const topology = await this.axlAdapter.client.getTopology();

    if (!topology.ok) {
      if (this.eventPublisher) {
        await this.safePublishEvent({
          id: `event-${randomUUID()}`,
          runId,
          agentId: "agent-orchestrator",
          agentRole: "orchestrator",
          eventType: "warning",
          status: "warning",
          summary: `AXL topology probe failed: ${topology.error.message}`,
          payload: {
            axlBaseUrl: this.input.env.axl.nodeBaseUrl,
            timeoutMs: this.input.env.axl.requestTimeoutMs,
            fallbackPeerIdConfigured: hasConfiguredAxlServicePeer(this.input.env),
          },
          timestamp: observedAt,
          correlationId: `${runId}:axl-probe`,
          axlMessageId: null,
          proofRefId: null,
          signalId: null,
          intelId: null,
        });
      }

      if (hasConfiguredAxlServicePeer(this.input.env)) {
        this.axlServicePeerId = this.input.env.axl.servicePeerId;
        return true;
      }

      return false;
    }

    this.axlPeerRegistry.updatePeerStatuses(toAxlPeerStatuses(topology.value, observedAt));
    this.axlServicePeerId = topology.value.our_public_key;

    return true;
  }

  private async probeSpecialistService(input: {
    checkpoint: SwarmCheckpoint;
    toRole: (typeof axlStepRoleMap)[keyof typeof axlStepRoleMap];
    timestamp: string;
  }) {
    if (!this.axlAdapter || !this.axlServicePeerId) {
      return {
        ok: false as const,
        error: new Error("AXL MCP transport is not initialized."),
      };
    }

    const method = axlHealthMethodByRole[input.toRole];
    const response = await this.axlAdapter.callMcp({
      peerId: this.axlServicePeerId,
      service: input.toRole,
      request: {
        jsonrpc: "2.0",
        id: `${input.checkpoint.runId}:${input.checkpoint.step}:health`,
        service: input.toRole,
        method,
        params: {},
        context: {
          runId: input.checkpoint.runId,
          correlationId: `${input.checkpoint.runId}:${input.checkpoint.step}`,
          callerPeerId: this.axlServicePeerId,
          callerRole: "orchestrator",
        },
      },
    });

    if (!response.ok) {
      return response;
    }

    const responseError =
      "error" in response.value &&
      response.value.error &&
      typeof response.value.error === "object" &&
      "message" in response.value.error
        ? response.value.error
        : null;

    if (responseError) {
      return {
        ok: false as const,
        error: new Error(String(responseError.message ?? "AXL MCP call failed.")),
      };
    }

    return { ok: true as const, value: response.value };
  }

  private async safePublishFinalArtifacts(finalState: SwarmState) {
    if (!this.zeroGPublisher) {
      return {
        artifacts: [],
        computeError: null,
      };
    }

    try {
      const finalArtifacts = [...this.artifacts];
      const appendRecordedArtifacts = async (artifacts: ProofArtifact[]) => {
        for (const artifact of artifacts) {
          await this.safeRecordArtifact(artifact);

          if (!finalArtifacts.some((entry) => entry.id === artifact.id)) {
            finalArtifacts.push(artifact);
          }
        }
      };
      const reportPrompt = [
        `Run ${finalState.run.id} completed with outcome ${finalState.run.outcome?.outcomeType ?? "no_conviction"}.`,
        `Market bias: ${finalState.run.marketBias}.`,
        `Evidence items: ${finalState.evidenceItems.length.toString()}.`,
        `Top notes: ${finalState.notes.slice(-5).join(" | ") || "none"}.`,
      ].join(" ");
      const runArtifacts = await this.zeroGPublisher.publishRunArtifacts({
        environment: this.environment,
        state: finalState,
        checkpointLabel: "final",
        logUploadsEnabled: true,
        reportPrompt: hasZeroGComputeConfig(this.input.env) ? reportPrompt : null,
        reportModel: this.input.env.zeroG.computeModel,
      });

      await appendRecordedArtifacts(runArtifacts.artifacts);

      if (this.evidenceBundlePublisher) {
        try {
          const evidenceBundle = await this.evidenceBundlePublisher.publish({
            environment: this.environment,
            state: finalState,
          });

          await appendRecordedArtifacts(evidenceBundle.artifacts);
        } catch (error) {
          this.logger.warn(
            "0G evidence bundle publish failed; continuing with final run artifacts.",
            error,
          );
        }
      }

      let evidenceBundleArtifact =
        [...finalArtifacts]
          .reverse()
          .find((artifact) => artifact.metadata?.artifactType === "evidence_pack") ?? null;

      if (this.reportBundlePublisher) {
        try {
          const reportBundle = await this.reportBundlePublisher.publish({
            environment: this.environment,
            state: finalState,
            reportText: runArtifacts.computeOutput,
            computeArtifact: runArtifacts.computeArtifact,
            evidenceBundleArtifact,
          });

          await appendRecordedArtifacts(reportBundle.artifacts);
        } catch (error) {
          this.logger.warn(
            "0G report bundle publish failed; continuing with available final artifacts.",
            error,
          );
        }
      }

      evidenceBundleArtifact =
        [...finalArtifacts]
          .reverse()
          .find((artifact) => artifact.metadata?.artifactType === "evidence_pack") ?? null;

      if (this.runManifestPublisher) {
        try {
          const manifestBundle = await this.runManifestPublisher.publish({
            environment: this.environment,
            run: finalState.run,
            artifacts: finalArtifacts,
          });

          await appendRecordedArtifacts([manifestBundle.manifestArtifact]);

          if (this.zeroGProofAnchor) {
            const anchored = await this.zeroGProofAnchor.anchorManifest({
              runId: finalState.run.id,
              signalId: finalState.run.finalSignalId,
              intelId: finalState.run.finalIntelId,
              manifestRoot: deriveManifestAnchorRoot(manifestBundle.manifestArtifact),
              locator: manifestBundle.manifestArtifact.locator,
              metadata: {
                manifestArtifactId: manifestBundle.manifestArtifact.id,
                manifestLocator: manifestBundle.manifestArtifact.locator,
                manifestKey: manifestBundle.manifestArtifact.key,
              },
            });

            if (anchored.ok && anchored.value) {
              await appendRecordedArtifacts([anchored.value.artifact]);
            }
          }
        } catch (error) {
          this.logger.warn("0G run manifest publish or chain anchor failed.", error);
        }
      }

      return {
        artifacts: finalArtifacts,
        computeError: runArtifacts.computeError,
      };
    } catch (error) {
      return {
        artifacts: [],
        computeError:
          error instanceof Error ? error.message : "0G final artifact publishing failed.",
      };
    }
  }

  private async safePublishCheckpointState(checkpoint: SwarmCheckpoint) {
    if (!this.zeroGStateStore) {
      throw new Error("0G checkpoint storage is not configured.");
    }

    const artifact = await this.zeroGStateStore.writeRunCheckpoint({
      environment: this.environment,
      runId: checkpoint.runId,
      checkpointLabel: checkpoint.step,
      state: checkpoint.state,
      signalId: null,
      intelId: null,
      metadata: {
        checkpointId: checkpoint.checkpointId,
        threadId: checkpoint.threadId,
      },
    });

    if (!artifact.ok) {
      throw new Error(
        `Failed to publish 0G checkpoint state for ${checkpoint.step}: ${artifact.error.message}`,
      );
    }

    await this.safeRecordArtifact(artifact.value);
    return artifact.value;
  }

  private async tryPublishCheckpointState(checkpoint: SwarmCheckpoint) {
    try {
      return await this.safePublishCheckpointState(checkpoint);
    } catch (error) {
      this.logger.warn(
        `0G checkpoint state publish failed for ${checkpoint.step}; continuing without a durable checkpoint ref.`,
        error,
      );
      return null;
    }
  }

  private async safeAppendCheckpointLog(checkpoint: SwarmCheckpoint, summary: string) {
    if (!this.zeroGLogStore) {
      throw new Error("0G checkpoint log storage is not configured.");
    }

    const artifact = await this.zeroGLogStore.appendRunLog({
      environment: this.environment,
      runId: checkpoint.runId,
      stream: checkpoint.step,
      content: [
        summary,
        JSON.stringify({
          checkpointId: checkpoint.checkpointId,
          step: checkpoint.step,
          stateDelta: checkpoint.stateDelta,
        }),
      ],
      signalId: null,
      intelId: null,
      metadata: {
        checkpointId: checkpoint.checkpointId,
      },
    });

    if (!artifact.ok) {
      throw new Error(
        `Failed to publish 0G checkpoint log for ${checkpoint.step}: ${artifact.error.message}`,
      );
    }

    await this.safeRecordArtifact(artifact.value);
    return artifact.value;
  }

  private async tryAppendCheckpointLog(checkpoint: SwarmCheckpoint, summary: string) {
    try {
      return await this.safeAppendCheckpointLog(checkpoint, summary);
    } catch (error) {
      this.logger.warn(
        `0G checkpoint log publish failed for ${checkpoint.step}; continuing with checkpoint state only.`,
        error,
      );
      return null;
    }
  }

  private async safeRecordArtifact(artifact: ProofArtifact) {
    const alreadyRecorded = this.artifacts.some((entry) => entry.id === artifact.id);

    if (!alreadyRecorded) {
      this.artifacts.push(artifact);
    }

    if (this.zeroGRefRecorder && !alreadyRecorded) {
      const recorded = await this.zeroGRefRecorder.recordArtifact(artifact);

      if (!recorded.ok) {
        throw new Error(`Failed to persist 0G ref ${artifact.id}: ${recorded.error.message}`);
      }
    }
  }

  private async safeRecordAxlMessage(message: AxlEnvelope) {
    if (this.axlMessageRecorder) {
      const recorded = await this.axlMessageRecorder.recordMessage(message);

      if (!recorded.ok) {
        throw new Error(`Failed to persist AXL message ${message.id}: ${recorded.error.message}`);
      }
    }
  }

  private async safePublishNodeStatus(node: AgentNode) {
    if (this.eventPublisher) {
      const published = await this.eventPublisher.syncNodeStatus(node);

      if (!published.ok) {
        throw new Error(`Failed to persist node ${node.id}: ${published.error.message}`);
      }
    }
  }

  private async safePublishEvent(event: AgentEvent) {
    if (this.eventPublisher) {
      const published = await this.eventPublisher.publishEvent(event);

      if (!published.ok) {
        throw new Error(`Failed to persist event ${event.id}: ${published.error.message}`);
      }
    }
  }

  private toPersistableRun(run: SwarmState["run"]): SwarmState["run"] {
    const latestCheckpointArtifact = [...this.artifacts]
      .reverse()
      .find((artifact) => artifact.refType === "kv_state");

    return {
      ...run,
      currentCheckpointRefId: latestCheckpointArtifact?.id ?? null,
      finalSignalId: run.finalSignalId,
      finalIntelId: run.finalIntelId,
      outcome: run.outcome
        ? {
            ...run.outcome,
            signalId: run.outcome.signalId,
            intelId: run.outcome.intelId,
          }
        : null,
    };
  }

  private resolvePeerIdForStep(step: string) {
    const role = getRoleForStep(step);

    return role === "monitor" ? null : resolveAxlNodePeerId(this.input.env.axl.nodes, role);
  }

  private resolvePeerIdForRole(role: (typeof axlStepRoleMap)[keyof typeof axlStepRoleMap]) {
    return resolveAxlNodePeerId(this.input.env.axl.nodes, role);
  }
}

class LivePipelineCheckpointStore implements SwarmCheckpointStore {
  private latestCheckpoint: SwarmCheckpoint | null = null;

  private checkpointCount = 0;

  constructor(private readonly executionContext: LivePipelineExecutionContext) {}

  async save(checkpoint: SwarmCheckpoint) {
    const persistedCheckpoint = await this.executionContext.handleCheckpoint(checkpoint);

    this.latestCheckpoint = persistedCheckpoint;
    this.checkpointCount += 1;
  }

  async loadLatest(input: { runId: string; threadId: string }) {
    if (
      this.latestCheckpoint?.runId === input.runId &&
      this.latestCheckpoint.threadId === input.threadId
    ) {
      return this.latestCheckpoint;
    }

    return null;
  }

  async listByRun(runId: string) {
    if (!this.latestCheckpoint || this.latestCheckpoint.runId !== runId) {
      return [];
    }

    return Array.from({ length: this.checkpointCount }, () => this.latestCheckpoint!);
  }
}

export type LiveSwarmPipelineResult = {
  runId: string;
  completedAt: string;
  checkpointCount: number;
  outcomeType: NonNullable<SwarmState["run"]["outcome"]>["outcomeType"];
  finalState: SwarmState;
};

export type LiveSwarmPipeline = {
  run(request: SchedulerTaskContext): Promise<LiveSwarmPipelineResult>;
};

export class DefaultLiveSwarmRunPipeline implements LiveSwarmPipeline {
  constructor(
    private readonly input: {
      env: BackendEnv;
      graphFactory?: GraphFactory;
      checkpointStoreFactory?: () => SwarmCheckpointStore;
      marketUniverse?: string[];
      scanIntervalMinutes?: number;
      postToXEnabledOverride?: boolean;
      runtimeName?: string;
    },
  ) {}

  async run(request: SchedulerTaskContext): Promise<LiveSwarmPipelineResult> {
    const graphFactory = this.input.graphFactory ?? createOmenGraphFactory();
    const config = createLiveRuntimeConfig({
      env: this.input.env,
      request,
      marketUniverse: this.input.marketUniverse ?? [...DEFAULT_MARKET_UNIVERSE],
      scanIntervalMinutes: this.input.scanIntervalMinutes ?? DEFAULT_SCAN_INTERVAL_MINUTES,
      postToXEnabledOverride: this.input.postToXEnabledOverride,
    });
    const executionContext = new LivePipelineExecutionContext({
      env: this.input.env,
      request,
      config,
    });
    const initialState = graphFactory.createInitialState({
      run: createScheduledRun(request),
      config,
    });
    initialState.recentIntelHistory = await executionContext.loadRecentIntelHistory();
    initialState.recentPostContext = await executionContext.loadRecentPostContext();
    initialState.activeTradeSymbols = await executionContext.loadActiveTradeSymbols();

    await executionContext.prepareRun(initialState.run);

    const checkpointStore =
      this.input.checkpointStoreFactory?.() ?? executionContext.createCheckpointStore();
    const runtime = graphFactory.createRuntime({
      checkpointStore,
      runtimeName: this.input.runtimeName ?? "backend-live-swarm-pipeline",
    });
    try {
      const finalState = await runtime.invoke({
        threadId: `${request.runId}:thread`,
        initialState,
      });

      await executionContext.finalizeRun(finalState);

      const checkpoints = await checkpointStore.listByRun(request.runId);
      const outcome = finalState.run.outcome ?? {
        outcomeType: "no_conviction" as const,
        summary: "The swarm completed without a persisted outcome.",
        signalId: null,
        intelId: null,
      };

      return {
        runId: request.runId,
        completedAt: finalState.run.completedAt ?? new Date().toISOString(),
        checkpointCount: checkpoints.length,
        outcomeType: outcome.outcomeType,
        finalState,
      };
    } catch (error) {
      await executionContext.failRun({
        fallbackRun: initialState.run,
        checkpointStore,
        error: error instanceof Error ? error : new Error("Live swarm pipeline failed."),
      });
      throw error;
    }
  }
}
