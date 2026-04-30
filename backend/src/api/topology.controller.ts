import type { Request, Response } from "express";

import {
  AgentNodesRepository,
  ServiceRegistrySnapshotsRepository,
  createSupabaseServiceRoleClient,
} from "@omen/db";
import { agentNodeSchema } from "@omen/shared";
import {
  createTopologySnapshot,
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

const markVerifiedSnapshot = (
  snapshot: AxlServiceRegistrySnapshot,
): AxlServiceRegistrySnapshot =>
  createTopologySnapshot({
    capturedAt: snapshot.capturedAt,
    source: snapshot.source,
    peers: snapshot.peers,
    services: snapshot.services,
    routes: snapshot.routes,
    metadata: {
      ...snapshot.metadata,
      status: "verified",
      verified: true,
    },
  });

const buildUnavailableTopologySnapshot = (
  capturedAt = new Date().toISOString(),
): AxlServiceRegistrySnapshot =>
  createTopologySnapshot({
    capturedAt,
    source: "axl-service-registry",
    peers: [],
    services: [],
    routes: [],
    metadata: {
      status: "unverified",
      verified: false,
      reason:
        "No live AXL service registry snapshot is available. Agent-node data is not used as AXL evidence.",
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

    const topologySnapshot = snapshot.value
      ? markVerifiedSnapshot(snapshot.value)
      : buildUnavailableTopologySnapshot();

    res.json({
      success: true,
      data: {
        nodes: nodes.value.map((node) => agentNodeSchema.parse(node)),
        snapshot: topologySnapshot,
      },
    });
  };
