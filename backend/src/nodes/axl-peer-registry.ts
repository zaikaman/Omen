import {
  agentNodeSchema,
  type AgentNode,
  type AgentRole,
  type AxlDeliveryStatus,
  type AxlMcpServiceContract,
  type AxlPeerStatus,
} from "@omen/shared";
import {
  AxlServiceRegistry,
  createAxlServiceRouteRecord,
  defineAxlMcpServiceContract,
  type AxlServiceRegistrySnapshot,
  type AxlServiceRouteRecord,
} from "@omen/axl";

type ManagedAxlRole = Extract<
  AgentRole,
  | "orchestrator"
  | "market_bias"
  | "scanner"
  | "research"
  | "chart_vision"
  | "analyst"
  | "critic"
  | "intel"
  | "generator"
  | "writer"
  | "publisher"
  | "memory"
>;

const defaultMethodsByRole: Record<ManagedAxlRole, string[]> = {
  orchestrator: ["orchestrator.dispatch", "orchestrator.health"],
  market_bias: ["market_bias.derive", "market_bias.health"],
  scanner: ["scan.run", "scan.health"],
  research: ["research.bundle", "research.health"],
  chart_vision: ["chart_vision.analyze", "chart_vision.health"],
  analyst: ["thesis.generate", "analyst.health"],
  critic: ["critic.review", "critic.health"],
  intel: ["intel.summarize", "intel.health"],
  generator: ["generator.compose", "generator.health"],
  writer: ["writer.article", "writer.health"],
  publisher: ["publisher.publish", "publisher.health"],
  memory: ["memory.checkpoint", "memory.recall", "memory.health"],
};

const defaultDescriptionByRole: Record<ManagedAxlRole, string> = {
  orchestrator: "Scheduler-driven orchestrator entrypoint for the Omen swarm.",
  market_bias: "Market regime and directional bias derivation capability.",
  scanner: "Bias-aligned market scanning capability.",
  research: "Research bundle and catalyst synthesis capability.",
  chart_vision: "Chart frame analysis and technical evidence capability.",
  analyst: "Thesis generation capability.",
  critic: "Quality gate and final review capability.",
  intel: "Market intelligence report synthesis capability.",
  generator: "Publishable intel content generation capability.",
  writer: "Long-form intel article drafting capability.",
  publisher: "Outbound report and post publishing capability.",
  memory: "Durable checkpoint and proof reference memory capability.",
};

const toPeerHealth = (status: AgentNode["status"]): AxlPeerStatus["status"] => {
  if (status === "offline") {
    return "offline";
  }

  if (status === "degraded" || status === "starting") {
    return "degraded";
  }

  return "online";
};

const toNodeStatus = (status: AxlPeerStatus["status"]): AgentNode["status"] => {
  if (status === "offline") {
    return "offline";
  }

  if (status === "degraded") {
    return "degraded";
  }

  return "online";
};

export type LogicalAxlNodeRegistration = {
  agentId: string;
  role: ManagedAxlRole;
  peerId: string;
  service?: string;
  methods?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
  observedAt: string;
  status?: AgentNode["status"];
};

export class AxlPeerRegistry {
  private readonly nodes = new Map<string, AgentNode>();

  private readonly serviceRegistry = new AxlServiceRegistry();

  private rawTopologyPeerIds: string[] = [];

  private rawTopologyTreePeerIds: string[] = [];

  private rawTopologyObservedAt: string | null = null;

  registerLogicalNode(input: LogicalAxlNodeRegistration) {
    const contract = defineAxlMcpServiceContract({
      service: input.service ?? input.role,
      version: "0.1.0",
      peerId: input.peerId,
      role: input.role,
      description: input.description ?? defaultDescriptionByRole[input.role],
      methods: input.methods ?? defaultMethodsByRole[input.role],
      tools: [],
      tags: ["runtime", "mvp"],
    });
    const node = agentNodeSchema.parse({
      id: input.agentId,
      role: input.role,
      transport: "axl",
      status: input.status ?? "online",
      peerId: input.peerId,
      lastHeartbeatAt: input.observedAt,
      lastError: null,
      metadata: {
        ...(input.metadata ?? {}),
        services: [contract.service],
      },
    });

    this.nodes.set(node.id, node);
    this.serviceRegistry.updatePeerStatus({
      peerId: input.peerId,
      role: input.role,
      status: toPeerHealth(node.status),
      services: [contract.service],
      lastSeenAt: input.observedAt,
      latencyMs: null,
    });
    this.serviceRegistry.registerService({
      contract,
      observedAt: input.observedAt,
      status: toPeerHealth(node.status),
    });

    return { node, contract };
  }

  updatePeerStatuses(statuses: AxlPeerStatus[]) {
    for (const status of statuses) {
      this.serviceRegistry.updatePeerStatus(status);

      for (const [agentId, node] of this.nodes.entries()) {
        if (node.peerId === status.peerId) {
          this.nodes.set(agentId, {
            ...node,
            status: toNodeStatus(status.status),
            lastHeartbeatAt: status.lastSeenAt,
            lastError: status.status === "offline" ? "Peer reported offline." : null,
            metadata: {
              ...node.metadata,
              latencyMs: status.latencyMs,
              services: status.services,
            },
          });
        }
      }
    }

    return this.listNodes();
  }

  recordRawTopology(input: {
    peerIds: string[];
    treePeerIds?: string[];
    observedAt: string;
  }) {
    this.rawTopologyPeerIds = Array.from(new Set(input.peerIds.filter(Boolean))).sort();
    this.rawTopologyTreePeerIds = Array.from(new Set((input.treePeerIds ?? []).filter(Boolean))).sort();
    this.rawTopologyObservedAt = input.observedAt;
  }

  markNodeOffline(input: { agentId: string; observedAt: string; error?: string | null }) {
    const current = this.nodes.get(input.agentId);

    if (!current) {
      return null;
    }

    const nextNode = {
      ...current,
      status: "offline" as const,
      lastHeartbeatAt: input.observedAt,
      lastError: input.error ?? current.lastError,
    };
    this.nodes.set(input.agentId, nextNode);

    if (current.peerId) {
      this.serviceRegistry.updatePeerStatus({
        peerId: current.peerId,
        role: current.role,
        status: "offline",
        services: this.serviceRegistry
          .listServices({ peerId: current.peerId })
          .map((service) => service.service),
        lastSeenAt: input.observedAt,
        latencyMs: null,
      });
    }

    return nextNode;
  }

  recordRoute(input: {
    kind: AxlServiceRouteRecord["kind"];
    peerId: string;
    sourcePeerId?: string | null;
    destinationPeerId?: string | null;
    role?: string | null;
    service: string | null;
    method?: string | null;
    operation: string;
    runId: string | null;
    correlationId: string | null;
    delegationId?: string | null;
    routeChainId?: string | null;
    deliveryStatus: AxlDeliveryStatus;
    observedAt: string;
    acceptedAt?: string | null;
    completedAt?: string | null;
    failedAt?: string | null;
    outputRefs?: AxlServiceRouteRecord["outputRefs"];
    metadata?: Record<string, unknown>;
  }) {
    const delegationId =
      input.delegationId ??
      (typeof input.metadata?.delegationId === "string" ? input.metadata.delegationId : null);
    const routeChainId = input.routeChainId ?? input.correlationId ?? delegationId ?? input.runId;
    const failedAt = input.failedAt ?? (input.deliveryStatus === "failed" ? input.observedAt : null);
    const acceptedAt = input.acceptedAt ?? (input.deliveryStatus === "sent" ? input.observedAt : null);
    const completedAt =
      input.completedAt ?? (input.deliveryStatus === "received" ? input.observedAt : null);
    const route = createAxlServiceRouteRecord({
      kind: input.kind,
      peerId: input.peerId,
      sourcePeerId: input.sourcePeerId ?? null,
      destinationPeerId: input.destinationPeerId ?? input.peerId,
      role: input.role ?? input.service,
      service: input.service,
      method: input.method ?? input.operation,
      operation: input.operation,
      runId: input.runId,
      correlationId: input.correlationId,
      delegationId,
      routeChainId,
      deliveryStatus: input.deliveryStatus,
      observedAt: input.observedAt,
      acceptedAt,
      completedAt,
      failedAt,
      topologyPeerIds: this.rawTopologyPeerIds,
      outputRefs: input.outputRefs ?? [],
      metadata: input.metadata ?? {},
    });

    this.serviceRegistry.recordRoute(route);
    return route;
  }

  listNodes() {
    return Array.from(this.nodes.values()).sort((left, right) => left.id.localeCompare(right.id));
  }

  getNodeByRole(role: ManagedAxlRole) {
    return this.listNodes().find((node) => node.role === role) ?? null;
  }

  listNodesByRole(role: ManagedAxlRole) {
    return this.listNodes().filter((node) => node.role === role);
  }

  getNodeByPeerId(peerId: string) {
    return this.listNodes().find((node) => node.peerId === peerId) ?? null;
  }

  listServices(
    filters: {
      peerId?: string;
      role?: AxlMcpServiceContract["role"];
      service?: string;
    } = {},
  ) {
    return this.serviceRegistry.listServices(filters);
  }

  linkRunOutputs(input: {
    runId: string;
    signalId?: string | null;
    intelId?: string | null;
  }) {
    this.serviceRegistry.linkRunOutputs(input);
  }

  createSnapshot(input: {
    capturedAt: string;
    source: string;
    metadata?: Record<string, unknown>;
  }): AxlServiceRegistrySnapshot {
    return this.serviceRegistry.createSnapshot({
      ...input,
      metadata: {
        rawTopologyPeerIds: this.rawTopologyPeerIds,
        rawTopologyTreePeerIds: this.rawTopologyTreePeerIds,
        rawTopologyObservedAt: this.rawTopologyObservedAt,
        ...(input.metadata ?? {}),
      },
    });
  }
}
