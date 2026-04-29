import type { Request, Response } from "express";

import {
  AgentNodesRepository,
  ServiceRegistrySnapshotsRepository,
  createSupabaseServiceRoleClient,
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
  type AxlServiceRegistrySnapshot,
} from "@omen/axl";

import type { BackendEnv } from "../bootstrap/env.js";

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

const safeAxlMethodPattern = /^[a-zA-Z0-9._/-]+$/;

const toServiceMethod = (service: string, node: AgentNode) =>
  safeAxlMethodPattern.test(service) ? service : `${node.role}.health`;

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
        registrationId: `${node.peerId ?? node.id}:${service}`,
        service,
        version: "live",
        peerId: node.peerId,
        role: node.role,
        description: `${node.role} service`,
        methods: [toServiceMethod(service, node)],
        tools: [],
        tags: [],
        status: node.status === "starting" ? "degraded" : node.status,
        registeredAt: node.lastHeartbeatAt ?? new Date().toISOString(),
        lastSeenAt: node.lastHeartbeatAt ?? new Date().toISOString(),
      }),
    );
  });

export const buildFallbackTopologySnapshot = (
  nodes: AgentNode[],
  capturedAt = new Date().toISOString(),
): AxlServiceRegistrySnapshot =>
  axlServiceRegistrySnapshotSchema.parse({
    capturedAt,
    source: "agent-nodes",
    peers: nodes.flatMap((node) => {
      const peerStatus = toPeerStatus(node);
      return peerStatus ? [peerStatus] : [];
    }),
    services: buildServicesFromNodes(nodes),
    routes: [],
    metadata: {
      fallback: true,
      reason: "No live AXL service registry snapshot is available.",
      nodeCount: nodes.length,
    },
  });

export const createTopologyController =
  (env: Pick<BackendEnv, "supabase">) => async (_req: Request, res: Response) => {
    if (!isPersistenceConfigured(env)) {
      res.status(503).json({
        success: false,
        error: "Topology requires a configured Supabase persistence backend.",
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

    const topologySnapshot =
      snapshot.value ?? buildFallbackTopologySnapshot(nodes.value);

    res.json({
      success: true,
      data: {
        nodes: nodes.value.map((node) => agentNodeSchema.parse(node)),
        snapshot: topologySnapshot,
      },
    });
  };
