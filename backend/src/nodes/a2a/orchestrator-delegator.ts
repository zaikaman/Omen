import {
  type AnalystOutput,
  type AnalystInput,
  type ChartVisionOutput,
  type ChartVisionInput,
  type CriticOutput,
  type CriticInput,
  type GeneratorOutput,
  type GeneratorInput,
  type IntelOutput,
  type IntelInput,
  type MarketBiasAgentOutput,
  type MarketBiasAgentInput,
  type MemoryOutput,
  type MemoryInput,
  type PublisherOutput,
  type PublisherInput,
  type ResearchOutput,
  type ResearchInput,
  type ScannerOutput,
  type ScannerInput,
  type WriterOutput,
  type WriterInput,
} from "@omen/agents";
import { createDelegationRequest } from "@omen/axl";
import type { AxlA2AClient } from "@omen/axl";
import { err, type Result } from "@omen/shared";

import type { AxlPeerRegistry } from "../axl-peer-registry.js";
import { A2AResponseCorrelator, type CorrelatedDelegationResult } from "./response-correlator.js";

type SpecialistRole =
  | "market_bias"
  | "scanner"
  | "research"
  | "chart_vision"
  | "analyst"
  | "critic"
  | "generator"
  | "intel"
  | "writer"
  | "memory"
  | "publisher";

type DelegationContext = {
  runId: string;
  correlationId: string;
  fromPeerId: string;
  timeoutMs?: number | null;
  routeHints?: string[];
};

type SpecialistPayloadMap = {
  market_bias: MarketBiasAgentInput;
  scanner: ScannerInput;
  research: ResearchInput;
  chart_vision: ChartVisionInput;
  analyst: AnalystInput;
  critic: CriticInput;
  generator: GeneratorInput;
  intel: IntelInput;
  writer: WriterInput;
  memory: MemoryInput;
  publisher: PublisherInput;
};

const parsePeerContext = (output: unknown) => {
  if (!output || typeof output !== "object" || !("peerContext" in output)) {
    return null;
  }

  const peerContext = (output as { peerContext?: unknown }).peerContext;

  return peerContext && typeof peerContext === "object"
    ? (peerContext as Record<string, unknown>)
    : null;
};

type SpecialistResultMap = {
  market_bias: CorrelatedDelegationResult<MarketBiasAgentOutput>;
  scanner: CorrelatedDelegationResult<ScannerOutput>;
  research: CorrelatedDelegationResult<ResearchOutput>;
  chart_vision: CorrelatedDelegationResult<ChartVisionOutput>;
  analyst: CorrelatedDelegationResult<AnalystOutput>;
  critic: CorrelatedDelegationResult<CriticOutput>;
  generator: CorrelatedDelegationResult<GeneratorOutput>;
  intel: CorrelatedDelegationResult<IntelOutput>;
  writer: CorrelatedDelegationResult<WriterOutput>;
  memory: CorrelatedDelegationResult<MemoryOutput>;
  publisher: CorrelatedDelegationResult<PublisherOutput>;
};

type TaskTypeMap = {
  market_bias: "market_bias.derive";
  scanner: "scan.run";
  research: "research.bundle";
  chart_vision: "chart_vision.analyze";
  analyst: "thesis.generate";
  critic: "critic.review";
  generator: "generator.compose";
  intel: "intel.summarize";
  writer: "writer.article";
  memory: "memory.checkpoint";
  publisher: "publisher.publish";
};

const taskTypeByRole: TaskTypeMap = {
  market_bias: "market_bias.derive",
  scanner: "scan.run",
  research: "research.bundle",
  chart_vision: "chart_vision.analyze",
  analyst: "thesis.generate",
  critic: "critic.review",
  generator: "generator.compose",
  intel: "intel.summarize",
  writer: "writer.article",
  memory: "memory.checkpoint",
  publisher: "publisher.publish",
};

export class OrchestratorDelegator {
  private readonly correlator: A2AResponseCorrelator;

  constructor(
    private readonly input: {
      client: AxlA2AClient;
      peerRegistry: Pick<AxlPeerRegistry, "getNodeByRole" | "recordRoute">;
      correlator?: A2AResponseCorrelator;
    },
  ) {
    this.correlator = input.correlator ?? new A2AResponseCorrelator();
  }

  delegateMarketBias(input: {
    context: DelegationContext;
    payload: MarketBiasAgentInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("market_bias", input.context, input.payload, input.preferredPeerId);
  }

  delegateScanner(input: {
    context: DelegationContext;
    payload: ScannerInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("scanner", input.context, input.payload, input.preferredPeerId);
  }

  delegateResearch(input: {
    context: DelegationContext;
    payload: ResearchInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("research", input.context, input.payload, input.preferredPeerId);
  }

  delegateAnalyst(input: {
    context: DelegationContext;
    payload: AnalystInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("analyst", input.context, input.payload, input.preferredPeerId);
  }

  delegateChartVision(input: {
    context: DelegationContext;
    payload: ChartVisionInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("chart_vision", input.context, input.payload, input.preferredPeerId);
  }

  delegateCritic(input: {
    context: DelegationContext;
    payload: CriticInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("critic", input.context, input.payload, input.preferredPeerId);
  }

  delegateGenerator(input: {
    context: DelegationContext;
    payload: GeneratorInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("generator", input.context, input.payload, input.preferredPeerId);
  }

  delegateIntel(input: {
    context: DelegationContext;
    payload: IntelInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("intel", input.context, input.payload, input.preferredPeerId);
  }

  delegateWriter(input: {
    context: DelegationContext;
    payload: WriterInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("writer", input.context, input.payload, input.preferredPeerId);
  }

  delegateMemory(input: {
    context: DelegationContext;
    payload: MemoryInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("memory", input.context, input.payload, input.preferredPeerId);
  }

  delegatePublisher(input: {
    context: DelegationContext;
    payload: PublisherInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("publisher", input.context, input.payload, input.preferredPeerId);
  }

  private async delegate<TRole extends SpecialistRole>(
    role: TRole,
    context: DelegationContext,
    payload: SpecialistPayloadMap[TRole],
    preferredPeerId?: string | null,
  ): Promise<Result<SpecialistResultMap[TRole], Error>> {
    const node = this.input.peerRegistry.getNodeByRole(role);
    const peerId = preferredPeerId ?? node?.peerId;

    if (!peerId) {
      return err(new Error(`No AXL peer is registered for ${role}.`));
    }

    const taskType = taskTypeByRole[role];
    const request = createDelegationRequest({
      delegationId: `${context.correlationId}:${role}`,
      runId: context.runId,
      correlationId: context.correlationId,
      fromPeerId: context.fromPeerId,
      fromRole: "orchestrator",
      toPeerId: peerId,
      requestedRole: role,
      taskType,
      requiredServices: [taskType],
      payload: payload as Record<string, unknown>,
      timeoutMs: context.timeoutMs ?? null,
      routeHints: Array.from(
        new Set([...(context.routeHints ?? []), ...(preferredPeerId ? [preferredPeerId] : [])]),
      ),
    });

    this.input.peerRegistry.recordRoute({
      kind: "a2a",
      peerId,
      sourcePeerId: context.fromPeerId,
      destinationPeerId: peerId,
      role,
      service: role,
      method: taskType,
      operation: taskType,
      runId: context.runId,
      correlationId: context.correlationId,
      delegationId: request.delegationId,
      deliveryStatus: "sent",
      observedAt: new Date().toISOString(),
      metadata: {
        delegationId: request.delegationId,
        direction: "request",
      },
    });

    const envelope = await this.input.client.delegate({
      peerId,
      request,
    });

    if (!envelope.ok) {
      this.input.peerRegistry.recordRoute({
        kind: "a2a",
        peerId,
        sourcePeerId: context.fromPeerId,
        destinationPeerId: peerId,
        role,
        service: role,
        method: taskType,
        operation: taskType,
        runId: context.runId,
        correlationId: context.correlationId,
        delegationId: request.delegationId,
        deliveryStatus: "failed",
        observedAt: new Date().toISOString(),
        metadata: {
          delegationId: request.delegationId,
          error: envelope.error.message,
        },
      });

      return envelope;
    }

    const correlated = this.correlate(role, envelope.value);
    const completedAt = new Date().toISOString();
    const childPeerContext = correlated.ok ? parsePeerContext(correlated.value.output) : null;

    this.input.peerRegistry.recordRoute({
      kind: "a2a",
      peerId,
      sourcePeerId: context.fromPeerId,
      destinationPeerId: peerId,
      role,
      service: role,
      method: taskType,
      operation: taskType,
      runId: context.runId,
      correlationId: context.correlationId,
      delegationId: request.delegationId,
      deliveryStatus: correlated.ok ? "received" : "failed",
      observedAt: completedAt,
      completedAt: correlated.ok ? completedAt : null,
      failedAt: correlated.ok ? null : completedAt,
      metadata: {
        delegationId: request.delegationId,
        state: envelope.value.result?.state ?? null,
        assignedPeerId: envelope.value.receipt?.assignedPeerId ?? null,
        childPeerContext,
      },
    });

    if (childPeerContext) {
      const childDestinationPeerId =
        typeof childPeerContext.sourcePeerId === "string" ? childPeerContext.sourcePeerId : null;
      const childService =
        typeof childPeerContext.service === "string" ? childPeerContext.service : null;
      const childMethod =
        typeof childPeerContext.method === "string" ? childPeerContext.method : "peer-context";

      if (childDestinationPeerId && childService) {
        this.input.peerRegistry.recordRoute({
          kind: "mcp",
          peerId: childDestinationPeerId,
          sourcePeerId: peerId,
          destinationPeerId: childDestinationPeerId,
          role: childService,
          service: childService,
          method: childMethod,
          operation: childMethod,
          runId: context.runId,
          correlationId: `${context.correlationId}:${childService}`,
          delegationId: `${request.delegationId}:${childService}`,
          routeChainId: request.delegationId,
          deliveryStatus: "received",
          observedAt: completedAt,
          completedAt,
          metadata: {
            parentDelegationId: request.delegationId,
            direction: `${role}->${childService}`,
            summary:
              typeof childPeerContext.summary === "string" ? childPeerContext.summary : null,
          },
        });
      }
    }

    return correlated;
  }

  private correlate<TRole extends SpecialistRole>(
    role: TRole,
    envelope: Awaited<ReturnType<AxlA2AClient["delegate"]>> extends Result<infer TValue, Error>
      ? TValue
      : never,
  ): Result<SpecialistResultMap[TRole], Error> {
    switch (role) {
      case "market_bias":
        return this.correlator.correlateMarketBias(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "scanner":
        return this.correlator.correlateScanner(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "research":
        return this.correlator.correlateResearch(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "chart_vision":
        return this.correlator.correlateChartVision(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "analyst":
        return this.correlator.correlateAnalyst(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "critic":
        return this.correlator.correlateCritic(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "generator":
        return this.correlator.correlateGenerator(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "intel":
        return this.correlator.correlateIntel(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "writer":
        return this.correlator.correlateWriter(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "memory":
        return this.correlator.correlateMemory(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      case "publisher":
        return this.correlator.correlatePublisher(envelope) as Result<
          SpecialistResultMap[TRole],
          Error
        >;
      default:
        return err(new Error(`Unsupported specialist role ${String(role)}.`));
    }
  }
}
