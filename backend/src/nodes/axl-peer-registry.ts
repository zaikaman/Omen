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
  memory: ["memory.checkpoint", "memory.health"],
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
    service: string | null;
    operation: string;
    runId: string | null;
    correlationId: string | null;
    deliveryStatus: AxlDeliveryStatus;
    observedAt: string;
    metadata?: Record<string, unknown>;
  }) {
    const route = createAxlServiceRouteRecord({
      kind: input.kind,
      peerId: input.peerId,
      service: input.service,
      operation: input.operation,
      runId: input.runId,
      correlationId: input.correlationId,
      deliveryStatus: input.deliveryStatus,
      observedAt: input.observedAt,
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

  createSnapshot(input: {
    capturedAt: string;
    source: string;
    metadata?: Record<string, unknown>;
  }): AxlServiceRegistrySnapshot {
    return this.serviceRegistry.createSnapshot(input);
  }
}
