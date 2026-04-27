import { err, ok, type AxlDeliveryStatus, type Result } from "@omen/shared";
import type { AxlRouteKind, AxlRegisteredService } from "@omen/axl";

import type { AxlPeerRegistry } from "../axl-peer-registry.js";

type ManagedRole = Parameters<AxlPeerRegistry["getNodeByRole"]>[0];
type CandidateNodeStatus = "starting" | "online" | "degraded" | "offline" | "unknown";
type FailoverRegistry = Pick<
  AxlPeerRegistry,
  "listNodesByRole" | "listServices" | "recordRoute"
>;

type CandidateService = AxlRegisteredService & {
  nodeStatus: CandidateNodeStatus;
};

const serviceScore = (service: CandidateService) => {
  const serviceWeight =
    service.status === "online" ? 2 : service.status === "degraded" ? 1 : 0;
  const nodeWeight =
    service.nodeStatus === "online" ? 2 : service.nodeStatus === "degraded" ? 1 : 0;

  return serviceWeight * 10 + nodeWeight;
};

export class PeerFailover {
  constructor(private readonly peerRegistry: FailoverRegistry) {}

  resolvePeer(input: {
    role: ManagedRole;
    service: string;
    operation: string;
    preferredPeerId?: string | null;
    excludedPeerIds?: string[];
    runId?: string | null;
    correlationId?: string | null;
    kind?: AxlRouteKind;
  }): Result<
    {
      peerId: string;
      rerouted: boolean;
      reason: "preferred" | "rerouted";
      service: CandidateService;
    },
    Error
  > {
    const excluded = new Set(input.excludedPeerIds ?? []);
    const candidates = this.getCandidates(input.role, input.service).filter(
      (candidate) =>
        candidate.status !== "offline" &&
        candidate.nodeStatus !== "offline" &&
        !excluded.has(candidate.peerId ?? ""),
    );

    if (candidates.length === 0) {
      return err(
        new Error(
          `No AXL peers are available for ${input.role}/${input.service}.`,
        ),
      );
    }

    const preferred =
      input.preferredPeerId
        ? candidates.find((candidate) => candidate.peerId === input.preferredPeerId) ?? null
        : null;

    if (preferred?.peerId) {
      return ok({
        peerId: preferred.peerId,
        rerouted: false,
        reason: "preferred",
        service: preferred,
      });
    }

    const fallback = candidates[0];

    if (!fallback?.peerId) {
      return err(
        new Error(`Resolved AXL service ${input.service} does not have a peer binding.`),
      );
    }

    this.peerRegistry.recordRoute({
      kind: input.kind ?? "a2a",
      peerId: fallback.peerId,
      service: fallback.service,
      operation: input.operation,
      runId: input.runId ?? null,
      correlationId: input.correlationId ?? null,
      deliveryStatus: "queued" satisfies AxlDeliveryStatus,
      observedAt: new Date().toISOString(),
      metadata: {
        resolution: "rerouted",
        previousPeerId: input.preferredPeerId ?? null,
        excludedPeerIds: Array.from(excluded),
      },
    });

    return ok({
      peerId: fallback.peerId,
      rerouted: true,
      reason: "rerouted",
      service: fallback,
    });
  }

  private getCandidates(role: ManagedRole, service: string): CandidateService[] {
    const nodeStatusByPeer = new Map(
      this.peerRegistry
        .listNodesByRole(role)
        .map((node) => [node.peerId, node.status] as const),
    );

    return this.peerRegistry
      .listServices({ role, service })
      .map((registeredService) => {
        const nodeStatus: CandidateNodeStatus =
          (registeredService.peerId
            ? nodeStatusByPeer.get(registeredService.peerId)
            : null) ?? "unknown";

        return {
          ...registeredService,
          nodeStatus,
        };
      })
      .sort((left, right) => serviceScore(right) - serviceScore(left));
  }
}
