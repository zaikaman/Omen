import {
  type AnalystOutput,
  type AnalystInput,
  type CriticOutput,
  type CriticInput,
  type ResearchOutput,
  type ResearchInput,
  type ScannerOutput,
  type ScannerInput,
} from "@omen/agents";
import {
  createDelegationRequest,
} from "@omen/axl";
import type { AxlA2AClient } from "@omen/axl";
import { err, type Result } from "@omen/shared";

import type { AxlPeerRegistry } from "../axl-peer-registry";
import {
  A2AResponseCorrelator,
  type CorrelatedDelegationResult,
} from "./response-correlator";

type SpecialistRole = "scanner" | "research" | "analyst" | "critic";

type DelegationContext = {
  runId: string;
  correlationId: string;
  fromPeerId: string;
  timeoutMs?: number | null;
  routeHints?: string[];
};

type SpecialistPayloadMap = {
  scanner: ScannerInput;
  research: ResearchInput;
  analyst: AnalystInput;
  critic: CriticInput;
};

type SpecialistResultMap = {
  scanner: CorrelatedDelegationResult<ScannerOutput>;
  research: CorrelatedDelegationResult<ResearchOutput>;
  analyst: CorrelatedDelegationResult<AnalystOutput>;
  critic: CorrelatedDelegationResult<CriticOutput>;
};

type TaskTypeMap = {
  scanner: "scan.run";
  research: "research.bundle";
  analyst: "thesis.generate";
  critic: "critic.review";
};

const taskTypeByRole: TaskTypeMap = {
  scanner: "scan.run",
  research: "research.bundle",
  analyst: "thesis.generate",
  critic: "critic.review",
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

  delegateCritic(input: {
    context: DelegationContext;
    payload: CriticInput;
    preferredPeerId?: string | null;
  }) {
    return this.delegate("critic", input.context, input.payload, input.preferredPeerId);
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
      service: role,
      operation: taskType,
      runId: context.runId,
      correlationId: context.correlationId,
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
        service: role,
        operation: taskType,
        runId: context.runId,
        correlationId: context.correlationId,
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

    this.input.peerRegistry.recordRoute({
      kind: "a2a",
      peerId,
      service: role,
      operation: taskType,
      runId: context.runId,
      correlationId: context.correlationId,
      deliveryStatus: correlated.ok ? "received" : "failed",
      observedAt: new Date().toISOString(),
      metadata: {
        delegationId: request.delegationId,
        state: envelope.value.result?.state ?? null,
        assignedPeerId: envelope.value.receipt?.assignedPeerId ?? null,
      },
    });

    return correlated;
  }

  private correlate<TRole extends SpecialistRole>(
    role: TRole,
    envelope: Awaited<ReturnType<AxlA2AClient["delegate"]>> extends Result<infer TValue, Error>
      ? TValue
      : never,
  ): Result<SpecialistResultMap[TRole], Error> {
    switch (role) {
      case "scanner":
        return this.correlator.correlateScanner(
          envelope,
        ) as Result<SpecialistResultMap[TRole], Error>;
      case "research":
        return this.correlator.correlateResearch(
          envelope,
        ) as Result<SpecialistResultMap[TRole], Error>;
      case "analyst":
        return this.correlator.correlateAnalyst(
          envelope,
        ) as Result<SpecialistResultMap[TRole], Error>;
      case "critic":
        return this.correlator.correlateCritic(
          envelope,
        ) as Result<SpecialistResultMap[TRole], Error>;
      default:
        return err(new Error(`Unsupported specialist role ${String(role)}.`));
    }
  }
}
