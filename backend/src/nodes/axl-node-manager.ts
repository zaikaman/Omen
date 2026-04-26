import {
  ok,
} from "@omen/shared";
import type { AgentNode, AxlEnvelope, Result } from "@omen/shared";
import type { AxlHttpNodeAdapter, ReceivedAxlEnvelope } from "@omen/axl";

import type { AxlPeerRegistry, LogicalAxlNodeRegistration } from "./axl-peer-registry";

type ManagedRole = LogicalAxlNodeRegistration["role"];

const defaultManagedRoles = [
  "orchestrator",
  "scanner",
  "research",
  "analyst",
  "critic",
] as const satisfies readonly ManagedRole[];

export class AxlNodeManager {
  constructor(
    private readonly input: {
      adapter: AxlHttpNodeAdapter;
      peerRegistry: AxlPeerRegistry;
      orchestratorPeerId: string;
      specialistPeerPrefix?: string;
    },
  ) {}

  registerLogicalNode(input: LogicalAxlNodeRegistration) {
    return this.input.peerRegistry.registerLogicalNode(input);
  }

  registerDefaultLogicalNodes(observedAt = new Date().toISOString()) {
    const peerPrefix = this.input.specialistPeerPrefix ?? "peer";

    return defaultManagedRoles.map((role) =>
      this.registerLogicalNode({
        agentId: `agent-${role}-001`,
        role,
        peerId:
          role === "orchestrator"
            ? this.input.orchestratorPeerId
            : `${peerPrefix}-${role}`,
        observedAt,
        metadata: {
          managedBy: "axl-node-manager",
        },
      }),
    );
  }

  listManagedNodes(): AgentNode[] {
    return this.input.peerRegistry.listNodes();
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
