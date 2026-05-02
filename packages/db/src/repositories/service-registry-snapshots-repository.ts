import type {
  AxlServiceRegistrySnapshot,
  AxlServiceRouteRecord,
  AxlRegisteredService,
} from "@omen/axl";
import { axlServiceRegistrySnapshotSchema } from "@omen/axl";

import { BaseRepository, type RepositoryError } from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { err, ok, type Result } from "@omen/shared";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

type ServiceRegistrySnapshotRow = {
  id: string;
  captured_at: string;
  source: string;
  peers: AxlServiceRegistrySnapshot["peers"];
  services: AxlRegisteredService[];
  routes: AxlServiceRouteRecord[];
  metadata: Record<string, unknown>;
};

type ServiceRegistrySnapshotInsert = Omit<ServiceRegistrySnapshotRow, "id">;

const axlEvidenceSnapshotSources = [
  "live-swarm-prepare",
  "live-swarm-a2a",
  "live-swarm-final-output",
] as const;

const toSnapshot = (row: ServiceRegistrySnapshotRow): AxlServiceRegistrySnapshot =>
  axlServiceRegistrySnapshotSchema.parse({
    capturedAt: normalizeDatabaseTimestamp(row.captured_at),
    source: row.source,
    peers: row.peers,
    services: row.services,
    routes: row.routes,
    metadata: row.metadata,
  });

const toRow = (snapshot: AxlServiceRegistrySnapshot): ServiceRegistrySnapshotInsert => ({
  captured_at: snapshot.capturedAt,
  source: snapshot.source,
  peers: snapshot.peers,
  services: snapshot.services,
  routes: snapshot.routes,
  metadata: snapshot.metadata,
});

export class ServiceRegistrySnapshotsRepository extends BaseRepository<
  ServiceRegistrySnapshotRow,
  ServiceRegistrySnapshotInsert
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "service_registry_snapshots");
  }

  async captureSnapshot(
    snapshot: AxlServiceRegistrySnapshot,
  ): Promise<Result<AxlServiceRegistrySnapshot, RepositoryError>> {
    const inserted = await this.insertOne(toRow(snapshot));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toSnapshot(inserted.value));
  }

  async latestSnapshot(
    options: { runId?: string | null } = {},
  ): Promise<Result<AxlServiceRegistrySnapshot | null, RepositoryError>> {
    const query = this.table()
      .select("*")
      .in("source", [...axlEvidenceSnapshotSources])
      .order("captured_at", { ascending: false })
      .limit(1);

    if (options.runId) {
      query.contains("metadata", { runId: options.runId });
    }

    const { data, error } = await query.maybeSingle<ServiceRegistrySnapshotRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toSnapshot(data) : null);
  }

  async listRecentSnapshots(limit = 20) {
    const listed = await this.list({
      limit,
      orderBy: "captured_at",
      ascending: false,
    });

    if (!listed.ok) {
      return listed;
    }

    return ok(listed.value.map((row) => toSnapshot(row)));
  }
}
