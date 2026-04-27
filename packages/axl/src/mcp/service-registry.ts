import type {
  AxlMcpServiceContract,
  AxlPeerStatus,
} from "@omen/shared";
import { axlPeerStatusSchema } from "@omen/shared";

import {
  createTopologySnapshot,
  registerAxlService,
  type AxlRegisteredService,
  type AxlServiceRegistrySnapshot,
  type AxlServiceRouteRecord,
} from "../topology/topology-snapshot.js";

type PeerStatusLevel = AxlPeerStatus["status"];

export class AxlServiceRegistry {
  private readonly peerStatuses = new Map<string, AxlPeerStatus>();

  private readonly services = new Map<string, AxlRegisteredService>();

  private readonly routes: AxlServiceRouteRecord[] = [];

  updatePeerStatus(status: AxlPeerStatus) {
    const parsed = axlPeerStatusSchema.parse(status);
    this.peerStatuses.set(parsed.peerId, parsed);
    return parsed;
  }

  registerService(input: {
    contract: AxlMcpServiceContract;
    observedAt: string;
    status?: PeerStatusLevel;
  }) {
    const peerStatus =
      (input.contract.peerId
        ? this.peerStatuses.get(input.contract.peerId)
        : null) ?? null;
    const resolvedStatus = input.status ?? peerStatus?.status ?? "online";
    const registrationId = `${input.contract.peerId ?? "unbound"}:${input.contract.service}:${input.contract.version}`;
    const existing = this.services.get(registrationId);

    const registered = registerAxlService({
      contract: input.contract,
      registrationId,
      status: resolvedStatus,
      registeredAt: existing?.registeredAt ?? input.observedAt,
      lastSeenAt: input.observedAt,
    });

    this.services.set(registrationId, registered);
    return registered;
  }

  removePeer(peerId: string) {
    this.peerStatuses.delete(peerId);

    for (const [registrationId, service] of this.services.entries()) {
      if (service.peerId === peerId) {
        this.services.delete(registrationId);
      }
    }
  }

  recordRoute(route: AxlServiceRouteRecord) {
    this.routes.push(route);
    return route;
  }

  listPeerStatuses() {
    return Array.from(this.peerStatuses.values()).sort((left, right) =>
      left.peerId.localeCompare(right.peerId),
    );
  }

  listServices(filters: {
    peerId?: string;
    role?: AxlMcpServiceContract["role"];
    service?: string;
  } = {}) {
    return Array.from(this.services.values())
      .filter((service) =>
        filters.peerId ? service.peerId === filters.peerId : true,
      )
      .filter((service) => (filters.role ? service.role === filters.role : true))
      .filter((service) =>
        filters.service ? service.service === filters.service : true,
      )
      .sort((left, right) => left.service.localeCompare(right.service));
  }

  listRoutes(limit = 50) {
    return this.routes
      .slice(Math.max(this.routes.length - limit, 0))
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  }

  createSnapshot(input: {
    capturedAt: string;
    source: string;
    metadata?: Record<string, unknown>;
  }): AxlServiceRegistrySnapshot {
    return createTopologySnapshot({
      capturedAt: input.capturedAt,
      source: input.source,
      peers: this.listPeerStatuses(),
      services: this.listServices(),
      routes: this.listRoutes(),
      metadata: input.metadata ?? {},
    });
  }
}
