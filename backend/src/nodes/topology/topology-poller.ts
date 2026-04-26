import { err, ok, type Result } from "@omen/shared";
import type { AxlHttpNodeAdapter, AxlServiceRegistrySnapshot } from "@omen/axl";

import type { AxlPeerRegistry } from "../axl-peer-registry";
import type { ServiceRegistrySync } from "./service-registry-sync";

type TopologyAdapter = Pick<AxlHttpNodeAdapter, "snapshotPeers">;
type RegistryUpdater = Pick<AxlPeerRegistry, "updatePeerStatuses" | "listNodes">;

export class TopologyPoller {
  constructor(
    private readonly input: {
      adapter: TopologyAdapter;
      peerRegistry: RegistryUpdater;
      sync: Pick<ServiceRegistrySync, "captureSnapshot">;
      source?: string;
    },
  ) {}

  async poll(input: {
    capturedAt?: string;
    metadata?: Record<string, unknown>;
  } = {}): Promise<Result<AxlServiceRegistrySnapshot, Error>> {
    const capturedAt = input.capturedAt ?? new Date().toISOString();
    const peerStatuses = await this.input.adapter.snapshotPeers();

    if (!peerStatuses.ok) {
      return err(peerStatuses.error);
    }

    const nodes = this.input.peerRegistry.updatePeerStatuses(peerStatuses.value);
    const snapshot = await this.input.sync.captureSnapshot({
      capturedAt,
      source: this.input.source ?? "axl-topology-poller",
      metadata: {
        peerCount: peerStatuses.value.length,
        managedNodeCount: nodes.length,
        ...(input.metadata ?? {}),
      },
    });

    if (!snapshot.ok) {
      return err(snapshot.error);
    }

    return ok(snapshot.value);
  }
}
