import {
  analyticsSnapshotSchema,
  err,
  ok,
  type AnalyticsSnapshot,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

type AnalyticsSnapshotRow = {
  id: string;
  run_id: string | null;
  generated_at: string;
  totals: AnalyticsSnapshot["totals"];
  confidence_bands: AnalyticsSnapshot["confidenceBands"];
  token_frequency: AnalyticsSnapshot["tokenFrequency"];
  mindshare: AnalyticsSnapshot["mindshare"];
  win_rate: number | null;
};

type AnalyticsSnapshotInsert = {
  id?: string;
  run_id?: string | null;
  generated_at?: string;
  totals: AnalyticsSnapshot["totals"];
  confidence_bands?: AnalyticsSnapshot["confidenceBands"];
  token_frequency?: AnalyticsSnapshot["tokenFrequency"];
  mindshare?: AnalyticsSnapshot["mindshare"];
  win_rate?: number | null;
};

type AnalyticsSnapshotUpdate = Partial<AnalyticsSnapshotInsert>;

const toAnalyticsSnapshot = (row: AnalyticsSnapshotRow): AnalyticsSnapshot =>
  analyticsSnapshotSchema.parse({
    id: row.id,
    runId: row.run_id,
    generatedAt: normalizeDatabaseTimestamp(row.generated_at),
    totals: row.totals,
    confidenceBands: row.confidence_bands,
    tokenFrequency: row.token_frequency,
    mindshare: row.mindshare,
    winRate: row.win_rate,
  });

const toInsertRow = (snapshot: AnalyticsSnapshot): AnalyticsSnapshotInsert => ({
  id: snapshot.id,
  run_id: snapshot.runId,
  generated_at: snapshot.generatedAt,
  totals: snapshot.totals,
  confidence_bands: snapshot.confidenceBands,
  token_frequency: snapshot.tokenFrequency,
  mindshare: snapshot.mindshare,
  win_rate: snapshot.winRate,
});

const toUpdateRow = (
  patch: Partial<AnalyticsSnapshot>,
): AnalyticsSnapshotUpdate => ({
  run_id: patch.runId,
  generated_at: patch.generatedAt,
  totals: patch.totals,
  confidence_bands: patch.confidenceBands,
  token_frequency: patch.tokenFrequency,
  mindshare: patch.mindshare,
  win_rate: patch.winRate,
});

export class AnalyticsSnapshotsRepository extends BaseRepository<
  AnalyticsSnapshotRow,
  AnalyticsSnapshotInsert,
  AnalyticsSnapshotUpdate
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "analytics_snapshots");
  }

  async createSnapshot(
    snapshot: AnalyticsSnapshot,
  ): Promise<Result<AnalyticsSnapshot, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(snapshot));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toAnalyticsSnapshot(inserted.value));
  }

  async updateSnapshot(
    snapshotId: string,
    patch: Partial<AnalyticsSnapshot>,
  ): Promise<Result<AnalyticsSnapshot, RepositoryError>> {
    const updated = await this.updateById(snapshotId, toUpdateRow(patch));

    if (!updated.ok) {
      return updated;
    }

    return ok(toAnalyticsSnapshot(updated.value));
  }

  async listRecentSnapshots(
    limit = 20,
  ): Promise<Result<AnalyticsSnapshot[], RepositoryError>> {
    const listed = await this.list({
      limit,
      orderBy: "generated_at",
      ascending: false,
    });

    if (!listed.ok) {
      return listed;
    }

    return ok(listed.value.map((row) => toAnalyticsSnapshot(row)));
  }

  async findLatestSnapshot(): Promise<
    Result<AnalyticsSnapshot | null, RepositoryError>
  > {
    const { data, error } = await this.table()
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle<AnalyticsSnapshotRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toAnalyticsSnapshot(data) : null);
  }

  async listByRunId(
    runId: string,
    limit = 20,
  ): Promise<Result<AnalyticsSnapshot[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .order("generated_at", { ascending: false })
      .limit(limit)
      .returns<AnalyticsSnapshotRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toAnalyticsSnapshot(row)));
  }
}
