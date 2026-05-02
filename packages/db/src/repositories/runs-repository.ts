import {
  err,
  ok,
  runSchema,
  type Run,
  type RunStatus,
  type RunTrigger,
  type RuntimeMode,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

type RunRow = {
  id: string;
  mode: RuntimeMode;
  status: RunStatus;
  market_bias: Run["marketBias"];
  started_at: string | null;
  completed_at: string | null;
  triggered_by: RunTrigger;
  active_candidate_count: number;
  current_checkpoint_ref_id: string | null;
  final_signal_id: string | null;
  final_intel_id: string | null;
  failure_reason: string | null;
  outcome: Run["outcome"];
  config_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type RunInsert = {
  id?: string;
  mode: RuntimeMode;
  status: RunStatus;
  market_bias: Run["marketBias"];
  started_at?: string | null;
  completed_at?: string | null;
  triggered_by: RunTrigger;
  active_candidate_count: number;
  current_checkpoint_ref_id?: string | null;
  final_signal_id?: string | null;
  final_intel_id?: string | null;
  failure_reason?: string | null;
  outcome?: Run["outcome"];
  config_snapshot: Record<string, unknown>;
};

type RunUpdate = Partial<RunInsert> & {
  updated_at?: string;
};

export type RunTraceTimingRow = {
  run_id: string;
  timestamp: string;
};

export type RunTraceTiming = {
  traceStartedAt: string | null;
  traceCompletedAt: string | null;
};

const toRun = (row: RunRow): Run =>
  runSchema.parse({
    id: row.id,
    mode: row.mode,
    status: row.status,
    marketBias: row.market_bias,
    startedAt: normalizeDatabaseTimestamp(row.started_at),
    completedAt: normalizeDatabaseTimestamp(row.completed_at),
    triggeredBy: row.triggered_by,
    activeCandidateCount: row.active_candidate_count,
    currentCheckpointRefId: row.current_checkpoint_ref_id,
    finalSignalId: row.final_signal_id,
    finalIntelId: row.final_intel_id,
    failureReason: row.failure_reason,
    outcome: row.outcome,
    configSnapshot: row.config_snapshot,
    createdAt: normalizeDatabaseTimestamp(row.created_at),
    updatedAt: normalizeDatabaseTimestamp(row.updated_at),
  });

const toInsertRow = (run: Run): RunInsert => ({
  id: run.id,
  mode: run.mode,
  status: run.status,
  market_bias: run.marketBias,
  started_at: run.startedAt,
  completed_at: run.completedAt,
  triggered_by: run.triggeredBy,
  active_candidate_count: run.activeCandidateCount,
  current_checkpoint_ref_id: run.currentCheckpointRefId,
  final_signal_id: run.finalSignalId,
  final_intel_id: run.finalIntelId,
  failure_reason: run.failureReason,
  outcome: run.outcome,
  config_snapshot: run.configSnapshot,
});

const toUpdateRow = (patch: Partial<Run>): RunUpdate => ({
  mode: patch.mode,
  status: patch.status,
  market_bias: patch.marketBias,
  started_at: patch.startedAt,
  completed_at: patch.completedAt,
  triggered_by: patch.triggeredBy,
  active_candidate_count: patch.activeCandidateCount,
  current_checkpoint_ref_id: patch.currentCheckpointRefId,
  final_signal_id: patch.finalSignalId,
  final_intel_id: patch.finalIntelId,
  failure_reason: patch.failureReason,
  outcome: patch.outcome,
  config_snapshot: patch.configSnapshot,
  updated_at: patch.updatedAt,
});

const toRepositoryError = (error: {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
}): RepositoryError => ({
  code: error.code ?? null,
  details: error.details ?? null,
  hint: error.hint ?? null,
  message: error.message,
});

export class RunsRepository extends BaseRepository<RunRow, RunInsert, RunUpdate> {
  constructor(client: OmenSupabaseClient) {
    super(client, "runs");
  }

  async findRunById(runId: string): Promise<Result<Run | null, RepositoryError>> {
    const found = await this.findById(runId);

    if (!found.ok) {
      return found;
    }

    return ok(found.value ? toRun(found.value) : null);
  }

  async createRun(run: Run): Promise<Result<Run, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(run));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toRun(inserted.value));
  }

  async updateRun(
    runId: string,
    patch: Partial<Run>,
  ): Promise<Result<Run, RepositoryError>> {
    const updated = await this.updateById(runId, toUpdateRow(patch));

    if (!updated.ok) {
      return updated;
    }

    return ok(toRun(updated.value));
  }

  async listRecentRuns(limit = 20): Promise<Result<Run[], RepositoryError>> {
    const listed = await this.list({
      limit,
      orderBy: "created_at",
      ascending: false,
    });

    if (!listed.ok) {
      return listed;
    }

    return ok(listed.value.map((row) => toRun(row)));
  }

  async listTraceTimingsByRunIds(
    runIds: string[],
  ): Promise<Result<Map<string, RunTraceTiming>, RepositoryError>> {
    if (runIds.length === 0) {
      return ok(new Map());
    }

    const { data, error } = await this.client
      .from("agent_events")
      .select("run_id,timestamp")
      .in("run_id", runIds)
      .order("timestamp", { ascending: true })
      .returns<RunTraceTimingRow[]>();

    if (error) {
      return err(toRepositoryError(error));
    }

    const timings = new Map<string, RunTraceTiming>();

    for (const row of data ?? []) {
      const normalizedTimestamp = normalizeDatabaseTimestamp(row.timestamp);
      const current = timings.get(row.run_id);

      if (!current) {
        timings.set(row.run_id, {
          traceStartedAt: normalizedTimestamp,
          traceCompletedAt: normalizedTimestamp,
        });
        continue;
      }

      current.traceCompletedAt = normalizedTimestamp;
    }

    return ok(timings);
  }

  async listScheduledRuns(limit = 20): Promise<Result<Run[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("triggered_by", "scheduler")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RunRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toRun(row)));
  }

  async findLatestRun(): Promise<Result<Run | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<RunRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toRun(data) : null);
  }

  async findActiveRun(): Promise<Result<Run | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .in("status", ["queued", "starting", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<RunRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toRun(data) : null);
  }

  async deleteRunCascade(runId: string): Promise<Result<void, RepositoryError>> {
    const clearedRunRefs = await this.client
      .from("runs")
      .update({
        current_checkpoint_ref_id: null,
        final_signal_id: null,
        final_intel_id: null,
      } as never)
      .eq("id", runId);

    if (clearedRunRefs.error) {
      return err(toRepositoryError(clearedRunRefs.error));
    }

    const clearedSignalRefs = await this.client
      .from("signals")
      .update({ final_report_ref_id: null } as never)
      .eq("run_id", runId);

    if (clearedSignalRefs.error) {
      return err(toRepositoryError(clearedSignalRefs.error));
    }

    const dependentTables = [
      "agent_events",
      "analytics_snapshots",
      "outbound_posts",
      "axl_messages",
      "zero_g_refs",
      "signals",
      "intels",
    ];

    for (const tableName of dependentTables) {
      const deleted = await this.client.from(tableName).delete().eq("run_id", runId);

      if (deleted.error) {
        return err(toRepositoryError(deleted.error));
      }
    }

    const deletedRun = await this.client.from("runs").delete().eq("id", runId);

    if (deletedRun.error) {
      return err(toRepositoryError(deletedRun.error));
    }

    return ok(undefined);
  }
}
