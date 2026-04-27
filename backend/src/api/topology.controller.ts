import type { Request, Response } from "express";

import {
  AgentNodesRepository,
  ServiceRegistrySnapshotsRepository,
  createSupabaseServiceRoleClient,
  demoAgentNodes,
  demoRunBundles,
} from "@omen/db";
import {
  agentNodeSchema,
  axlPeerStatusSchema,
  type AgentNode,
  type AxlPeerStatus,
} from "@omen/shared";
import {
  axlRegisteredServiceSchema,
  axlServiceRegistrySnapshotSchema,
} from "@omen/axl";

import type { BackendEnv } from "../bootstrap/env";

const isPersistenceConfigured = (env: Pick<BackendEnv, "supabase">) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const createRepositories = (env: Pick<BackendEnv, "supabase">) => {
  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url ?? "",
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey ?? "",
    serviceRoleKey: env.supabase.serviceRoleKey ?? "",
    schema: env.supabase.schema,
  });

  return {
    nodes: new AgentNodesRepository(client),
    serviceRegistrySnapshots: new ServiceRegistrySnapshotsRepository(client),
  };
};

const toPeerStatus = (node: AgentNode): AxlPeerStatus | null => {
  if (!node.peerId) {
    return null;
  }

  const services = Array.isArray(node.metadata.services)
    ? node.metadata.services.filter(
        (service): service is string =>
          typeof service === "string" && service.trim().length > 0,
      )
    : [];

  return axlPeerStatusSchema.parse({
    peerId: node.peerId,
    role: node.role,
    status: node.status === "starting" ? "degraded" : node.status,
    services,
    lastSeenAt: node.lastHeartbeatAt ?? new Date().toISOString(),
    latencyMs: null,
  });
};

const buildServicesFromNodes = (nodes: AgentNode[]) =>
  nodes.flatMap((node) => {
    const services = Array.isArray(node.metadata.services)
      ? node.metadata.services.filter(
          (service): service is string =>
            typeof service === "string" && service.trim().length > 0,
        )
      : [];

    return services.map((service) =>
      axlRegisteredServiceSchema.parse({
        registrationId: `${node.peerId ?? node.id}:${service}:demo`,
        service,
        version: "demo",
        peerId: node.peerId,
        role: node.role,
        description: `${node.role} service`,
        methods: [service],
        tools: [],
        tags: ["demo"],
        status: node.status === "starting" ? "degraded" : node.status,
        registeredAt: node.lastHeartbeatAt ?? new Date().toISOString(),
        lastSeenAt: node.lastHeartbeatAt ?? new Date().toISOString(),
      }),
    );
  });

const buildDemoTopologyResponse = () => {
  const nodes = demoAgentNodes;
  const nodeIndex = new Map(nodes.map((node) => [node.id, node] as const));

  return {
    nodes: nodes.map((node) => agentNodeSchema.parse(node)),
    snapshot: axlServiceRegistrySnapshotSchema.parse({
      capturedAt:
        nodes
          .map((node) => node.lastHeartbeatAt)
          .filter((value): value is string => value !== null)
          .sort()
          .at(-1) ?? new Date().toISOString(),
      source: "demo-seed",
      peers: nodes
        .map((node) => toPeerStatus(node))
        .filter((peer): peer is AxlPeerStatus => peer !== null),
      services: buildServicesFromNodes(nodes),
      routes: demoRunBundles
        .flatMap((bundle) => bundle.axlMessages)
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
        .map((message) => {
          const targetNode =
            (message.toAgentId ? nodeIndex.get(message.toAgentId) : null) ?? null;
          const sourceNode = nodeIndex.get(message.fromAgentId) ?? null;

          return {
            kind: message.transportKind,
            peerId:
              targetNode?.peerId ??
              sourceNode?.peerId ??
              message.toAgentId ??
              message.fromAgentId,
            service: message.topic,
            operation: message.messageType,
            runId: message.runId,
            correlationId: message.correlationId,
            deliveryStatus: message.deliveryStatus,
            observedAt: message.timestamp,
            metadata: {
              fromAgentId: message.fromAgentId,
              toAgentId: message.toAgentId,
              durableRefId: message.durableRefId,
            },
          };
        }),
      metadata: { mode: "demo" },
    }),
  };
};

export const createTopologyController =
  (env: Pick<BackendEnv, "supabase">) => async (_req: Request, res: Response) => {
    if (!isPersistenceConfigured(env)) {
      res.json({
        success: true,
        data: buildDemoTopologyResponse(),
      });
      return;
    }

    const repositories = createRepositories(env);
    const [nodes, snapshot] = await Promise.all([
      repositories.nodes.listNodes(100),
      repositories.serviceRegistrySnapshots.latestSnapshot(),
    ]);

    if (!nodes.ok) {
      res.status(500).json({ success: false, error: nodes.error.message });
      return;
    }

    if (!snapshot.ok) {
      res.status(500).json({ success: false, error: snapshot.error.message });
      return;
    }

    const fallbackSnapshot = axlServiceRegistrySnapshotSchema.parse({
        capturedAt: new Date().toISOString(),
        source: "agent-nodes-fallback",
        peers: nodes.value
          .map((node) => toPeerStatus(node))
          .filter((peer): peer is AxlPeerStatus => peer !== null),
        services: buildServicesFromNodes(nodes.value),
        routes: [],
        metadata: { synthesized: true },
    });

    res.json({
      success: true,
      data: {
        nodes: nodes.value.map((node) => agentNodeSchema.parse(node)),
        snapshot: snapshot.value ?? fallbackSnapshot,
      },
    });
  };
