import { ok } from "@omen/shared";
import type { AgentNode, AxlEnvelope, Result } from "@omen/shared";
import type { AxlHttpNodeAdapter, ReceivedAxlEnvelope } from "@omen/axl";

import type { AxlPeerRegistry, LogicalAxlNodeRegistration } from "./axl-peer-registry.js";

type ManagedRole = LogicalAxlNodeRegistration["role"];

const defaultManagedRoles = [
  "orchestrator",
  "market_bias",
  "scanner",
  "research",
  "chart_vision",
  "analyst",
  "critic",
  "intel",
  "generator",
  "writer",
  "publisher",
  "memory",
] as const satisfies readonly ManagedRole[];

const defaultAgentIdByRole: Record<ManagedRole, string> = {
  orchestrator: "agent-orchestrator",
  market_bias: "agent-market-bias-agent",
  scanner: "agent-scanner-agent",
  research: "agent-research-agent",
  chart_vision: "agent-chart-vision-agent",
  analyst: "agent-analyst-agent",
  critic: "agent-critic",
  intel: "agent-intel-agent",
  generator: "agent-generator-agent",
  writer: "agent-writer-agent",
  publisher: "agent-publisher",
  memory: "agent-memory-agent",
};

const isValidAxlPeerId = (value: string | undefined) =>
  Boolean(value && /^[0-9a-f]{64}$/i.test(value));

export class AxlNodeManager {
  constructor(
    private readonly input: {
      adapter: AxlHttpNodeAdapter;
      peerRegistry: AxlPeerRegistry;
      orchestratorPeerId: string;
      peerIdsByRole?: Partial<Record<ManagedRole, string>>;
      specialistPeerPrefix?: string;
    },
  ) {}

  registerLogicalNode(input: LogicalAxlNodeRegistration) {
    return this.input.peerRegistry.registerLogicalNode(input);
  }

  registerDefaultLogicalNodes(observedAt = new Date().toISOString()) {
    return defaultManagedRoles.flatMap((role) => {
      const peerId = this.resolvePeerId(role);

      if (!peerId) {
        return [];
      }

      return [
        this.registerLogicalNode({
          agentId: defaultAgentIdByRole[role],
          role,
          peerId,
          observedAt,
          metadata: {
            managedBy: "axl-node-manager",
          },
        }),
      ];
    });
  }

  listManagedNodes(): AgentNode[] {
    return this.input.peerRegistry.listNodes();
  }

  private resolvePeerId(role: ManagedRole) {
    const configured = this.input.peerIdsByRole?.[role];
    if (isValidAxlPeerId(configured)) {
      return configured;
    }

    if (role === "orchestrator" && isValidAxlPeerId(this.input.orchestratorPeerId)) {
      return this.input.orchestratorPeerId;
    }

    return null;
  }

  async syncPeerStatuses() {
    const result = await this.input.adapter.snapshotPeers();

    if (!result.ok) {
      return result;
    }

    return ok(this.input.peerRegistry.updatePeerStatuses(result.value));
  }

  async sendEnvelope(input: {
    destinationPeerId: string;
    envelope: AxlEnvelope;
    body?: Record<string, unknown>;
  }): Promise<Result<void, Error>> {
    const result = await this.input.adapter.sendEnvelope(input);
    const observedAt = new Date().toISOString();

    this.input.peerRegistry.recordRoute({
      kind: "send",
      peerId: input.destinationPeerId,
      service: input.envelope.toRole,
      operation: input.envelope.messageType,
      runId: input.envelope.runId,
      correlationId: input.envelope.correlationId,
      deliveryStatus: result.ok ? "sent" : "failed",
      observedAt,
      metadata: {
        topic: input.envelope.topic,
        toAgentId: input.envelope.toAgentId,
      },
    });

    return result;
  }

  async receiveEnvelope(): Promise<Result<ReceivedAxlEnvelope | null, Error>> {
    const result = await this.input.adapter.receiveEnvelope();

    if (!result.ok || result.value === null) {
      return result;
    }

    const { fromPeerId, message } = result.value;

    this.input.peerRegistry.recordRoute({
      kind: "send",
      peerId: fromPeerId ?? message.envelope.fromAgentId,
      service: message.envelope.toRole,
      operation: message.envelope.messageType,
      runId: message.envelope.runId,
      correlationId: message.envelope.correlationId,
      deliveryStatus: "received",
      observedAt: new Date().toISOString(),
      metadata: {
        fromPeerId,
        fromAgentId: message.envelope.fromAgentId,
      },
    });

    return ok(result.value);
  }

  markNodeOffline(input: { agentId: string; error?: string | null }) {
    return this.input.peerRegistry.markNodeOffline({
      agentId: input.agentId,
      observedAt: new Date().toISOString(),
      error: input.error,
    });
  }
}
