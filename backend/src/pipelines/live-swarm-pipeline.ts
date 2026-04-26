import { randomUUID } from "node:crypto";

import {
  createOmenGraphFactory,
  type GraphFactory,
  type SwarmCheckpoint,
  type SwarmCheckpointStore,
  type SwarmState,
} from "@omen/agents";
import { AxlHttpNodeAdapter } from "@omen/axl";
import {
  AgentEventsRepository,
  AgentNodesRepository,
  AxlMessagesRepository,
  RunsRepository,
  ZeroGRefsRepository,
  createSupabaseServiceRoleClient,
} from "@omen/db";
import {
  ZeroGClientAdapter,
  ZeroGLogStore,
  ZeroGStateStore,
  type ZeroGAdapterConfig,
} from "@omen/zero-g";
import type {
  AgentEvent,
  AgentEventType,
  AgentNode,
  AgentRole,
  AxlEnvelope,
  EventStatus,
  ProofArtifact,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env";
import { AxlNodeManager } from "../nodes/axl-node-manager";
import { AxlPeerRegistry } from "../nodes/axl-peer-registry";
import { EvidenceBundlePublisher } from "../publishers/evidence-bundle-publisher";
import { EventPublisher } from "../publishers/event-publisher";
import { ReportBundlePublisher } from "../publishers/report-bundle-publisher";
import { RunManifestPublisher } from "../publishers/run-manifest-publisher";
import { ZeroGPublisher } from "../publishers/zero-g-publisher";
import { AxlMessageRecorder } from "../publishers/axl-message-recorder";
import { ZeroGRefRecorder } from "../publishers/zero-g-ref-recorder";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler";

const DEFAULT_MARKET_UNIVERSE = ["BTC", "ETH", "SOL"] as const;
const DEFAULT_SCAN_INTERVAL_MINUTES = 60;

const managedStepRoleMap = {
  "market-bias-agent": "market_bias",
  "scanner-agent": "scanner",
  "research-agent": "research",
  "analyst-agent": "analyst",
  "critic-agent": "critic",
  "memory-agent": "memory",
  "publisher-agent": "publisher",
} as const satisfies Record<string, AgentRole>;

const stepEventTypeMap = {
  "market-bias-agent": "market_bias_generated",
  "scanner-agent": "candidate_found",
  "research-agent": "research_completed",
  "analyst-agent": "thesis_generated",
  "critic-agent": "critic_decision",
  "memory-agent": "zero_g_kv_write",
  "publisher-agent": "report_published",
} as const satisfies Record<string, AgentEventType>;

const axlStepRoleMap = {
  "scanner-agent": "scanner",
  "research-agent": "research",
  "analyst-agent": "analyst",
  "critic-agent": "critic",
} as const;

const getRoleForStep = (step: string): AgentRole =>
  managedStepRoleMap[step as keyof typeof managedStepRoleMap] ?? "monitor";

const getEventTypeForStep = (step: string): AgentEventType =>
  stepEventTypeMap[step as keyof typeof stepEventTypeMap] ?? "warning";

const hasTwitterPostingConfig = (env: BackendEnv) =>
  Boolean(
    env.twitterApi.apiKey &&
      env.twitterApi.loginCookies &&
      env.twitterApi.proxy,
  );

const hasSupabasePersistenceConfig = (env: BackendEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const hasAxlTransportConfig = (env: BackendEnv) =>
  Boolean(env.axl.nodeBaseUrl);

const hasZeroGStorageConfig = (env: BackendEnv) =>
  Boolean(env.zeroG.indexerUrl && env.zeroG.rpcUrl && env.zeroG.privateKey);

const hasZeroGComputeConfig = (env: BackendEnv) =>
  Boolean(env.zeroG.computeUrl && env.zeroG.computeApiKey);

const buildZeroGAdapterConfig = (
  env: BackendEnv,
): ZeroGAdapterConfig | null => {
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
      requestTimeoutMs: 10_000,
    },
    log: {
      baseUrl: env.zeroG.indexerUrl,
      evmRpcUrl: env.zeroG.rpcUrl ?? undefined,
      privateKey: env.zeroG.privateKey ?? undefined,
      expectedReplica: 1,
      requestTimeoutMs: 10_000,
    },
    compute: env.zeroG.computeUrl
      ? {
          baseUrl: env.zeroG.computeUrl,
          apiKey: env.zeroG.computeApiKey ?? undefined,
          requestTimeoutMs: 20_000,
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
      news: {
        enabled:
          externalReadsEnabled && Boolean(input.env.providers.tavilyApiKey),
        required: false,
      },
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
    case "analyst-agent":
      return `Analyst drafted ${checkpoint.state.thesisDrafts.length.toString()} thesis item(s).`;
    case "critic-agent": {
      const review = checkpoint.state.criticReviews.at(-1);
      return review
        ? `Critic decision: ${review.decision}.`
        : "Critic completed without a persisted review.";
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
  const transport =
    role === "scanner" ||
    role === "research" ||
    role === "analyst" ||
    role === "critic"
      ? "axl"
      : "local";

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
    },
  };
};

const createAgentEvent = (input: {
  checkpoint: SwarmCheckpoint;
  timestamp: string;
  status: EventStatus;
  summary: string;
  proofRefId?: string | null;
  axlMessageId?: string | null;
  payload?: Record<string, unknown>;
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
  signalId: input.checkpoint.state.run.finalSignalId,
  intelId: input.checkpoint.state.run.finalIntelId,
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

class InMemoryCheckpointStore implements SwarmCheckpointStore {
  protected readonly checkpoints: SwarmCheckpoint[] = [];

  async save(checkpoint: SwarmCheckpoint) {
    this.checkpoints.push(checkpoint);
  }

  async loadLatest(input: { runId: string; threadId: string }) {
    const matches = this.checkpoints.filter(
      (checkpoint) =>
        checkpoint.runId === input.runId && checkpoint.threadId === input.threadId,
    );

    return matches.length > 0 ? matches[matches.length - 1] ?? null : null;
  }

  async listByRun(runId: string) {
    return this.checkpoints.filter((checkpoint) => checkpoint.runId === runId);
  }
}

class LivePipelineExecutionContext {
  private readonly environment: string;

  private readonly runsRepository: RunsRepository | null;

  private readonly eventPublisher: EventPublisher | null;

  private readonly axlMessageRecorder: AxlMessageRecorder | null;

  private readonly zeroGRefRecorder: ZeroGRefRecorder | null;

  private readonly axlNodeManager: AxlNodeManager | null;

  private readonly axlPeerRegistry: AxlPeerRegistry | null;

  private readonly zeroGStateStore: ZeroGStateStore | null;

  private readonly zeroGLogStore: ZeroGLogStore | null;

  private readonly zeroGPublisher: ZeroGPublisher | null;

  private readonly evidenceBundlePublisher: EvidenceBundlePublisher | null;

  private readonly reportBundlePublisher: ReportBundlePublisher | null;

  private readonly runManifestPublisher: RunManifestPublisher | null;

  private axlTransportAvailable = false;

  private readonly artifacts: ProofArtifact[] = [];

  constructor(
    private readonly input: {
      env: BackendEnv;
      request: SchedulerTaskContext;
      config: SwarmState["config"];
    },
  ) {
    this.environment = toRuntimeEnvironment(input.request.mode.mode);

    const supabaseClient = hasSupabasePersistenceConfig(input.env)
      ? createServiceRoleClientFromEnv(input.env)
      : null;

    this.runsRepository = supabaseClient ? new RunsRepository(supabaseClient) : null;
    this.eventPublisher = supabaseClient
      ? new EventPublisher({
          events: new AgentEventsRepository(supabaseClient),
          nodes: new AgentNodesRepository(supabaseClient),
        })
      : null;
    this.axlMessageRecorder = supabaseClient
      ? new AxlMessageRecorder(new AxlMessagesRepository(supabaseClient))
      : null;
    this.zeroGRefRecorder = supabaseClient
      ? new ZeroGRefRecorder(new ZeroGRefsRepository(supabaseClient))
      : null;

    if (hasAxlTransportConfig(input.env)) {
      this.axlPeerRegistry = new AxlPeerRegistry();
      this.axlNodeManager = new AxlNodeManager({
        adapter: new AxlHttpNodeAdapter({
          node: {
            baseUrl: input.env.axl.nodeBaseUrl,
            requestTimeoutMs: 2_500,
            defaultHeaders: input.env.axl.apiToken
              ? {
                  Authorization: `Bearer ${input.env.axl.apiToken}`,
                }
              : {},
          },
        }),
        peerRegistry: this.axlPeerRegistry,
        orchestratorPeerId: input.env.axl.nodes.orchestrator,
      });
    } else {
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
    } else {
      this.zeroGStateStore = null;
      this.zeroGLogStore = null;
      this.zeroGPublisher = null;
      this.evidenceBundlePublisher = null;
      this.reportBundlePublisher = null;
      this.runManifestPublisher = null;
    }
  }

  createCheckpointStore() {
    return new LivePipelineCheckpointStore(this);
  }

  async prepareRun(run: SwarmState["run"]) {
    await this.safePersistRun(run);

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
      this.axlNodeManager.registerDefaultLogicalNodes(run.createdAt);
      this.axlTransportAvailable = await this.probeAxlTransport(run.id, run.createdAt);
    }
  }

  async handleCheckpoint(checkpoint: SwarmCheckpoint) {
    const persisted = { ...checkpoint };
    const timestamp = checkpoint.createdAt;
    const stepSummary = summarizeCheckpoint(checkpoint);
    const peerId = this.resolvePeerIdForStep(checkpoint.step);

    if (this.zeroGStateStore && this.zeroGLogStore) {
      const checkpointArtifact = await this.safePublishCheckpointState(persisted);

      if (checkpointArtifact) {
        persisted.durableRef = checkpointArtifact;
      }

      await this.safeAppendCheckpointLog(persisted, stepSummary);
    }

    if (this.eventPublisher) {
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
          },
        }),
      );
    }

    if (
      this.axlTransportAvailable &&
      this.axlNodeManager &&
      checkpoint.step in axlStepRoleMap
    ) {
      const toRole = axlStepRoleMap[checkpoint.step as keyof typeof axlStepRoleMap];
      const envelope = createAxlEnvelopeForCheckpoint({
        checkpoint: persisted,
        timestamp,
        toRole,
        toAgentId: `agent-${toRole}`,
        durableRefId: persisted.durableRef?.id ?? null,
      });
      const destinationPeerId = this.resolvePeerIdForRole(toRole);

      if (destinationPeerId) {
        const sendResult = await this.axlNodeManager.sendEnvelope({
          destinationPeerId,
          envelope,
          body: envelope.payload,
        });
        const recordedEnvelope: AxlEnvelope = {
          ...envelope,
          deliveryStatus: sendResult.ok ? "sent" : "failed",
        };

        await this.safeRecordAxlMessage(recordedEnvelope);

        if (this.eventPublisher) {
          await this.safePublishEvent({
            id: `event-${randomUUID()}`,
            runId: persisted.runId,
            agentId: "agent-orchestrator",
            agentRole: "orchestrator",
            eventType: "axl_message_sent",
            status: sendResult.ok ? "success" : "warning",
            summary: sendResult.ok
              ? `AXL envelope sent to ${toRole}.`
              : `AXL envelope failed for ${toRole}: ${sendResult.error.message}`,
            payload: {
              messageId: recordedEnvelope.id,
              toRole,
              deliveryStatus: recordedEnvelope.deliveryStatus,
              step: checkpoint.step,
            },
            timestamp,
            correlationId: recordedEnvelope.correlationId,
            axlMessageId: recordedEnvelope.id,
            proofRefId: null,
            signalId: persisted.state.run.finalSignalId,
            intelId: persisted.state.run.finalIntelId,
          });
        }
      }
    }

    return persisted;
  }

  async finalizeRun(finalState: SwarmState) {
    await this.safePersistRun(finalState.run);

    if (this.zeroGPublisher) {
      const zeroGArtifacts = await this.safePublishFinalArtifacts(finalState);

      if (zeroGArtifacts.length > 0 && this.eventPublisher) {
        await this.safePublishEvent(
          createRunLifecycleEvent({
            runId: finalState.run.id,
            timestamp: finalState.run.updatedAt,
            summary: `Published ${zeroGArtifacts.length.toString()} 0G artifact(s) for the completed run.`,
            status: "success",
            payload: {
              artifactCount: zeroGArtifacts.length,
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

    const existing = await this.runsRepository.findLatestRun();
    const shouldUpdate = existing.ok && existing.value?.id === run.id;

    if (shouldUpdate) {
      await this.runsRepository.updateRun(run.id, run);
      return;
    }

    await this.runsRepository.createRun(run);
  }

  private async probeAxlTransport(runId: string, observedAt: string) {
    if (!this.axlNodeManager) {
      return false;
    }

    const status = await this.axlNodeManager.syncPeerStatuses();

    if (!status.ok) {
      if (this.eventPublisher) {
        await this.safePublishEvent({
          id: `event-${randomUUID()}`,
          runId,
          agentId: "agent-orchestrator",
          agentRole: "orchestrator",
          eventType: "warning",
          status: "warning",
          summary: `AXL topology probe failed: ${status.error.message}`,
          payload: {
            axlBaseUrl: this.input.env.axl.nodeBaseUrl,
          },
          timestamp: observedAt,
          correlationId: `${runId}:axl-probe`,
          axlMessageId: null,
          proofRefId: null,
          signalId: null,
          intelId: null,
        });
      }

      return false;
    }

    return true;
  }

  private async safePublishCheckpointState(checkpoint: SwarmCheckpoint) {
    if (!this.zeroGStateStore) {
      return null;
    }

    const artifact = await this.zeroGStateStore.writeRunCheckpoint({
      environment: this.environment,
      runId: checkpoint.runId,
      checkpointLabel: checkpoint.step,
      state: checkpoint.state,
      signalId: checkpoint.state.run.finalSignalId,
      intelId: checkpoint.state.run.finalIntelId,
      metadata: {
        checkpointId: checkpoint.checkpointId,
        threadId: checkpoint.threadId,
      },
    });

    if (!artifact.ok) {
      return null;
    }

    await this.safeRecordArtifact(artifact.value);
    return artifact.value;
  }

  private async safeAppendCheckpointLog(
    checkpoint: SwarmCheckpoint,
    summary: string,
  ) {
    if (!this.zeroGLogStore) {
      return null;
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
      signalId: checkpoint.state.run.finalSignalId,
      intelId: checkpoint.state.run.finalIntelId,
      metadata: {
        checkpointId: checkpoint.checkpointId,
      },
    });

    if (!artifact.ok) {
      return null;
    }

    await this.safeRecordArtifact(artifact.value);
    return artifact.value;
  }

  private async safePublishFinalArtifacts(finalState: SwarmState) {
    if (
      !this.zeroGPublisher ||
      !this.evidenceBundlePublisher ||
      !this.reportBundlePublisher ||
      !this.runManifestPublisher
    ) {
      return [];
    }

    try {
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
        reportPrompt: hasZeroGComputeConfig(this.input.env) ? reportPrompt : null,
      });
      const evidenceArtifacts = await this.evidenceBundlePublisher.publish({
        environment: this.environment,
        state: finalState,
      });
      const reportArtifacts = await this.reportBundlePublisher.publish({
        environment: this.environment,
        state: finalState,
        reportText: finalState.publisherDrafts.map((draft) => draft.text).join("\n\n"),
        computeArtifact: runArtifacts.computeArtifact,
        evidenceBundleArtifact: evidenceArtifacts.evidenceBundleArtifact,
      });
      const manifestArtifacts = await this.runManifestPublisher.publish({
        environment: this.environment,
        run: finalState.run,
        artifacts: [
          ...this.artifacts,
          ...runArtifacts.artifacts,
          ...evidenceArtifacts.artifacts,
          ...reportArtifacts.artifacts,
        ],
      });
      const artifacts = [
        ...runArtifacts.artifacts,
        ...evidenceArtifacts.artifacts,
        ...reportArtifacts.artifacts,
        manifestArtifacts.manifestArtifact,
      ];

      for (const artifact of artifacts) {
        await this.safeRecordArtifact(artifact);
      }

      return artifacts;
    } catch {
      return [];
    }
  }

  private async safeRecordArtifact(artifact: ProofArtifact) {
    if (!this.artifacts.some((entry) => entry.id === artifact.id)) {
      this.artifacts.push(artifact);
    }

    if (this.zeroGRefRecorder) {
      await this.zeroGRefRecorder.recordArtifact(artifact);
    }
  }

  private async safeRecordAxlMessage(message: AxlEnvelope) {
    if (this.axlMessageRecorder) {
      await this.axlMessageRecorder.recordMessage(message);
    }
  }

  private async safePublishNodeStatus(node: AgentNode) {
    if (this.eventPublisher) {
      await this.eventPublisher.syncNodeStatus(node);
    }
  }

  private async safePublishEvent(event: AgentEvent) {
    if (this.eventPublisher) {
      await this.eventPublisher.publishEvent(event);
    }
  }

  private resolvePeerIdForStep(step: string) {
    switch (step) {
      case "scanner-agent":
        return this.input.env.axl.nodes.scanner;
      case "research-agent":
        return this.input.env.axl.nodes.research;
      case "analyst-agent":
        return this.input.env.axl.nodes.analyst;
      case "critic-agent":
        return this.input.env.axl.nodes.critic;
      default:
        return null;
    }
  }

  private resolvePeerIdForRole(
    role: (typeof axlStepRoleMap)[keyof typeof axlStepRoleMap],
  ) {
    switch (role) {
      case "scanner":
        return this.input.env.axl.nodes.scanner;
      case "research":
        return this.input.env.axl.nodes.research;
      case "analyst":
        return this.input.env.axl.nodes.analyst;
      case "critic":
        return this.input.env.axl.nodes.critic;
      default:
        return null;
    }
  }
}

class LivePipelineCheckpointStore extends InMemoryCheckpointStore {
  constructor(
    private readonly executionContext: LivePipelineExecutionContext,
  ) {
    super();
  }

  override async save(checkpoint: SwarmCheckpoint) {
    const persistedCheckpoint = await this.executionContext.handleCheckpoint(checkpoint);
    this.checkpoints.push(persistedCheckpoint);
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
      scanIntervalMinutes:
        this.input.scanIntervalMinutes ?? DEFAULT_SCAN_INTERVAL_MINUTES,
      postToXEnabledOverride: this.input.postToXEnabledOverride,
    });
    const initialState = graphFactory.createInitialState({
      run: createScheduledRun(request),
      config,
    });
    const executionContext = new LivePipelineExecutionContext({
      env: this.input.env,
      request,
      config,
    });

    await executionContext.prepareRun(initialState.run);

    const checkpointStore =
      this.input.checkpointStoreFactory?.() ?? executionContext.createCheckpointStore();
    const runtime = graphFactory.createRuntime({
      checkpointStore,
      runtimeName: this.input.runtimeName ?? "backend-live-swarm-pipeline",
    });
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
  }
}
