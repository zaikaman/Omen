import { axlPeerStatusSchema } from "@omen/shared";
import { z } from "zod";

export const axlTopologyPeerSchema = z.object({
  peer_id: z.string().min(1).optional(),
  uri: z.string().min(1).optional(),
  public_key: z.string().min(1).nullable().optional(),
  is_self: z.boolean().optional(),
  connection_state: z.string().min(1).optional(),
  up: z.boolean().optional(),
  inbound: z.boolean().optional(),
  port: z.number().int().optional(),
  root: z.string().optional(),
  coords: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const axlTopologyResponseSchema = z.object({
  our_ipv6: z.string().min(1).nullable().optional(),
  our_public_key: z.string().min(1),
  peers: z.array(axlTopologyPeerSchema).default([]),
  tree: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const toAxlPeerStatuses = (
  response: z.infer<typeof axlTopologyResponseSchema>,
  observedAt: string,
) =>
  response.peers.map((peer) =>
    axlPeerStatusSchema.parse({
      peerId: peer.peer_id ?? peer.public_key ?? peer.uri,
      role: "orchestrator",
      status:
        peer.up === true || peer.connection_state === "connected"
          ? "online"
          : peer.connection_state === "degraded"
            ? "degraded"
            : "offline",
      services: [],
      lastSeenAt: observedAt,
      latencyMs: null,
    }),
  );

export type AxlTopologyPeer = z.infer<typeof axlTopologyPeerSchema>;
export type AxlTopologyResponse = z.infer<typeof axlTopologyResponseSchema>;
