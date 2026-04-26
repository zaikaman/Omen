import type { ServiceRegistrySnapshotsRepository } from "@omen/db";
import { err, ok, type Result } from "@omen/shared";
import type { AxlServiceRegistrySnapshot } from "@omen/axl";

import type { AxlPeerRegistry } from "../axl-peer-registry";

type SnapshotRepository = Pick<ServiceRegistrySnapshotsRepository, "captureSnapshot">;
type RegistrySource = Pick<
  AxlPeerRegistry,
  "createSnapshot" | "listNodes" | "listServices"
>;

export class ServiceRegistrySync {
  constructor(
    private readonly input: {
      peerRegistry: RegistrySource;
      repository?: SnapshotRepository | null;
    },
  ) {}

  async captureSnapshot(input: {
    capturedAt?: string;
    source: string;
    metadata?: Record<string, unknown>;
  }): Promise<Result<AxlServiceRegistrySnapshot, Error>> {
    const capturedAt = input.capturedAt ?? new Date().toISOString();
    const snapshot = this.input.peerRegistry.createSnapshot({
      capturedAt,
      source: input.source,
      metadata: {
        nodeCount: this.input.peerRegistry.listNodes().length,
        serviceCount: this.input.peerRegistry.listServices().length,
        ...(input.metadata ?? {}),
      },
    });

    if (!this.input.repository) {
      return ok(snapshot);
    }

    const stored = await this.input.repository.captureSnapshot(snapshot);

    if (!stored.ok) {
      return err(new Error(stored.error.message));
    }

    return ok(stored.value);
  }
}
