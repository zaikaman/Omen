import {
  axlDeliveryStatusSchema,
  axlMcpServiceContractSchema,
  axlPeerStatusSchema,
  type AxlMcpServiceContract,
  type AxlPeerStatus,
} from "@omen/shared";
import { z } from "zod";

import {
  axlTopologyResponseSchema,
  toAxlPeerStatuses,
  type AxlTopologyResponse,
} from "../peer-status/peer-status.js";

export const axlRouteKindSchema = z.enum(["send", "mcp", "a2a"]);

export const axlRegisteredServiceSchema = axlMcpServiceContractSchema.extend({
  registrationId: z.string().min(1),
  status: z.enum(["online", "degraded", "offline"]),
  registeredAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const axlServiceRouteRecordSchema = z.object({
  kind: axlRouteKindSchema,
  peerId: z.string().min(1),
  sourcePeerId: z.string().min(1).nullable().default(null),
  destinationPeerId: z.string().min(1).nullable().default(null),
  role: z.string().min(1).nullable().default(null),
  service: z.string().min(1).nullable(),
  method: z.string().min(1).nullable().default(null),
  operation: z.string().min(1),
  runId: z.string().min(1).nullable(),
  correlationId: z.string().min(1).nullable(),
  delegationId: z.string().min(1).nullable().default(null),
  routeChainId: z.string().min(1).nullable().default(null),
  deliveryStatus: axlDeliveryStatusSchema,
  observedAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
  failedAt: z.string().datetime().nullable().default(null),
  topologyPeerIds: z.array(z.string().min(1)).default([]),
  outputRefs: z
    .array(
      z.object({
        kind: z.enum(["signal", "intel"]),
        id: z.string().min(1),
      }),
    )
    .default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const axlServiceRegistrySnapshotSchema = z.object({
  capturedAt: z.string().datetime(),
  source: z.string().min(1),
  peers: z.array(axlPeerStatusSchema).default([]),
  services: z.array(axlRegisteredServiceSchema).default([]),
  routes: z.array(axlServiceRouteRecordSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export function registerAxlService(input: {
  contract: AxlMcpServiceContract;
  registrationId: string;
  status: "online" | "degraded" | "offline";
  registeredAt: string;
  lastSeenAt: string;
}) {
  return axlRegisteredServiceSchema.parse({
    ...input.contract,
    registrationId: input.registrationId,
    status: input.status,
    registeredAt: input.registeredAt,
    lastSeenAt: input.lastSeenAt,
  });
}

export function createAxlServiceRouteRecord(
  input: z.input<typeof axlServiceRouteRecordSchema>,
) {
  return axlServiceRouteRecordSchema.parse(input);
}

export function createTopologySnapshot(input: {
  capturedAt: string;
  source: string;
  topology?: AxlTopologyResponse | z.input<typeof axlTopologyResponseSchema>;
  peers?: AxlPeerStatus[];
  services?: AxlRegisteredService[];
  routes?: AxlServiceRouteRecord[];
  metadata?: Record<string, unknown>;
}) {
  const topology = input.topology
    ? axlTopologyResponseSchema.parse(input.topology)
    : null;

  const peers =
    input.peers ??
    (topology ? toAxlPeerStatuses(topology, input.capturedAt) : []);

  return axlServiceRegistrySnapshotSchema.parse({
    capturedAt: input.capturedAt,
    source: input.source,
    peers,
    services: input.services ?? [],
    routes: input.routes ?? [],
    metadata: {
      ...(topology
        ? {
            axlTopology: {
              ourPublicKey: topology.our_public_key,
              peerIds: topology.peers
                .map((peer) => peer.peer_id ?? peer.public_key ?? peer.uri)
                .filter((peerId): peerId is string => Boolean(peerId)),
              treePeerIds: topology.tree
                .map((entry) => entry.public_key)
                .filter((peerId): peerId is string => typeof peerId === "string"),
            },
          }
        : {}),
      ...(input.metadata ?? {}),
    },
  });
}

export type AxlRouteKind = z.infer<typeof axlRouteKindSchema>;
export type AxlRegisteredService = z.infer<typeof axlRegisteredServiceSchema>;
export type AxlServiceRouteRecord = z.infer<typeof axlServiceRouteRecordSchema>;
export type AxlServiceRegistrySnapshot = z.infer<
  typeof axlServiceRegistrySnapshotSchema
>;
