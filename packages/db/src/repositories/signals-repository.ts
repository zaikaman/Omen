import {
  err,
  ok,
  signalSchema,
  type Signal,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

type SignalRow = {
  id: string;
  run_id: string;
  candidate_id: string | null;
  asset: string;
  direction: Signal["direction"];
  confidence: number;
  order_type: Signal["orderType"];
  trading_style: Signal["tradingStyle"];
  expected_duration: string | null;
  current_price: number | null;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  signal_status: Signal["signalStatus"];
  pnl_percent: number | null;
  closed_at: string | null;
  price_updated_at: string | null;
  risk_reward: number | null;
  entry_zone: Signal["entryZone"];
  invalidation: Signal["invalidation"];
  targets: Signal["targets"];
  why_now: string;
  confluences: string[];
  uncertainty_notes: string;
  missing_data_notes: string;
  critic_decision: Signal["criticDecision"];
  report_status: Signal["reportStatus"];
  final_report_ref_id: string | null;
  proof_ref_ids: string[];
  disclaimer: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type SignalInsert = {
  id?: string;
  run_id: string;
  candidate_id?: string | null;
  asset: string;
  direction: Signal["direction"];
  confidence: number;
  order_type?: Signal["orderType"];
  trading_style?: Signal["tradingStyle"];
  expected_duration?: string | null;
  current_price?: number | null;
  entry_price?: number | null;
  target_price?: number | null;
  stop_loss?: number | null;
  signal_status?: Signal["signalStatus"];
  pnl_percent?: number | null;
  closed_at?: string | null;
  price_updated_at?: string | null;
  risk_reward?: number | null;
  entry_zone?: Signal["entryZone"];
  invalidation?: Signal["invalidation"];
  targets?: Signal["targets"];
  why_now: string;
  confluences?: string[];
  uncertainty_notes: string;
  missing_data_notes: string;
  critic_decision: Signal["criticDecision"];
  report_status: Signal["reportStatus"];
  final_report_ref_id?: string | null;
  proof_ref_ids?: string[];
  disclaimer: string;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SignalUpdate = Partial<SignalInsert>;

const toSignal = (row: SignalRow): Signal =>
  signalSchema.parse({
    id: row.id,
    runId: row.run_id,
    candidateId: row.candidate_id,
    asset: row.asset,
    direction: row.direction,
    confidence: row.confidence,
    orderType: row.order_type,
    tradingStyle: row.trading_style,
    expectedDuration: row.expected_duration,
    currentPrice: row.current_price,
    entryPrice: row.entry_price,
    targetPrice: row.target_price,
    stopLoss: row.stop_loss,
    signalStatus: row.signal_status,
    pnlPercent: row.pnl_percent,
    closedAt: normalizeDatabaseTimestamp(row.closed_at),
    priceUpdatedAt: normalizeDatabaseTimestamp(row.price_updated_at),
    riskReward: row.risk_reward,
    entryZone: row.entry_zone,
    invalidation: row.invalidation,
    targets: row.targets,
    whyNow: row.why_now,
    confluences: row.confluences,
    uncertaintyNotes: row.uncertainty_notes,
    missingDataNotes: row.missing_data_notes,
    criticDecision: row.critic_decision,
    reportStatus: row.report_status,
    finalReportRefId: row.final_report_ref_id,
    proofRefIds: row.proof_ref_ids,
    disclaimer: row.disclaimer,
    publishedAt: normalizeDatabaseTimestamp(row.published_at),
    createdAt: normalizeDatabaseTimestamp(row.created_at),
    updatedAt: normalizeDatabaseTimestamp(row.updated_at),
  });

const toInsertRow = (signal: Signal): SignalInsert => ({
  id: signal.id,
  run_id: signal.runId,
  candidate_id: signal.candidateId,
  asset: signal.asset,
  direction: signal.direction,
  confidence: signal.confidence,
  order_type: signal.orderType,
  trading_style: signal.tradingStyle,
  expected_duration: signal.expectedDuration,
  current_price: signal.currentPrice,
  entry_price: signal.entryPrice,
  target_price: signal.targetPrice,
  stop_loss: signal.stopLoss,
  signal_status: signal.signalStatus,
  pnl_percent: signal.pnlPercent,
  closed_at: signal.closedAt,
  price_updated_at: signal.priceUpdatedAt,
  risk_reward: signal.riskReward,
  entry_zone: signal.entryZone,
  invalidation: signal.invalidation,
  targets: signal.targets,
  why_now: signal.whyNow,
  confluences: signal.confluences,
  uncertainty_notes: signal.uncertaintyNotes,
  missing_data_notes: signal.missingDataNotes,
  critic_decision: signal.criticDecision,
  report_status: signal.reportStatus,
  final_report_ref_id: signal.finalReportRefId,
  proof_ref_ids: signal.proofRefIds,
  disclaimer: signal.disclaimer,
  published_at: signal.publishedAt,
  created_at: signal.createdAt,
  updated_at: signal.updatedAt,
});

const toUpdateRow = (patch: Partial<Signal>): SignalUpdate => ({
  run_id: patch.runId,
  candidate_id: patch.candidateId,
  asset: patch.asset,
  direction: patch.direction,
  confidence: patch.confidence,
  order_type: patch.orderType,
  trading_style: patch.tradingStyle,
  expected_duration: patch.expectedDuration,
  current_price: patch.currentPrice,
  entry_price: patch.entryPrice,
  target_price: patch.targetPrice,
  stop_loss: patch.stopLoss,
  signal_status: patch.signalStatus,
  pnl_percent: patch.pnlPercent,
  closed_at: patch.closedAt,
  price_updated_at: patch.priceUpdatedAt,
  risk_reward: patch.riskReward,
  entry_zone: patch.entryZone,
  invalidation: patch.invalidation,
  targets: patch.targets,
  why_now: patch.whyNow,
  confluences: patch.confluences,
  uncertainty_notes: patch.uncertaintyNotes,
  missing_data_notes: patch.missingDataNotes,
  critic_decision: patch.criticDecision,
  report_status: patch.reportStatus,
  final_report_ref_id: patch.finalReportRefId,
  proof_ref_ids: patch.proofRefIds,
  disclaimer: patch.disclaimer,
  published_at: patch.publishedAt,
  created_at: patch.createdAt,
  updated_at: patch.updatedAt,
});

export class SignalsRepository extends BaseRepository<
  SignalRow,
  SignalInsert,
  SignalUpdate
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "signals");
  }

  async createSignal(signal: Signal): Promise<Result<Signal, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(signal));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toSignal(inserted.value));
  }

  async updateSignal(
    signalId: string,
    patch: Partial<Signal>,
  ): Promise<Result<Signal, RepositoryError>> {
    const updated = await this.updateById(signalId, toUpdateRow(patch));

    if (!updated.ok) {
      return updated;
    }

    return ok(toSignal(updated.value));
  }

  async findSignalById(
    signalId: string,
  ): Promise<Result<Signal | null, RepositoryError>> {
    const found = await this.findById(signalId);

    if (!found.ok) {
      return found;
    }

    return ok(found.value ? toSignal(found.value) : null);
  }

  async listRecentSignals(limit = 20): Promise<Result<Signal[], RepositoryError>> {
    const listed = await this.list({
      limit,
      orderBy: "published_at",
      ascending: false,
    });

    if (!listed.ok) {
      return listed;
    }

    return ok(listed.value.map((row) => toSignal(row)));
  }

  async listSignalHistory(options: {
    direction?: Signal["direction"] | null;
    limit?: number;
    offset?: number;
    query?: string | null;
    sortBy?:
      | "newest"
      | "oldest"
      | "confidence-high"
      | "confidence-low"
      | "pnl-high"
      | "pnl-low";
    status?: Signal["signalStatus"] | null;
  } = {}): Promise<Result<{ items: Signal[]; total: number }, RepositoryError>> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const sortBy = options.sortBy ?? "newest";
    const sortMap = {
      newest: { column: "published_at", ascending: false },
      oldest: { column: "published_at", ascending: true },
      "confidence-high": { column: "confidence", ascending: false },
      "confidence-low": { column: "confidence", ascending: true },
      "pnl-high": { column: "pnl_percent", ascending: false },
      "pnl-low": { column: "pnl_percent", ascending: true },
    } as const;
    const sort = sortMap[sortBy];
    const sanitizedQuery = options.query?.replace(/[%,()]/g, " ").trim();

    let query = this.table().select("*", { count: "exact" });

    if (options.status) {
      query = query.eq("signal_status", options.status);
    }

    if (options.direction) {
      query = query.eq("direction", options.direction);
    }

    if (sanitizedQuery) {
      const pattern = `%${sanitizedQuery}%`;
      query = query.or(
        [
          `asset.ilike.${pattern}`,
          `direction.ilike.${pattern}`,
          `why_now.ilike.${pattern}`,
          `uncertainty_notes.ilike.${pattern}`,
          `missing_data_notes.ilike.${pattern}`,
        ].join(","),
      );
    }

    const { data, error, count } = await query
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      .range(offset, offset + limit - 1)
      .returns<SignalRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok({
      items: (data ?? []).map((row) => toSignal(row)),
      total: count ?? 0,
    });
  }

  async listTrackableSignals(limit = 50): Promise<Result<Signal[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("report_status", "published")
      .in("direction", ["LONG", "SHORT"])
      .not("entry_price", "is", null)
      .not("target_price", "is", null)
      .not("stop_loss", "is", null)
      .or("signal_status.is.null,signal_status.in.(pending,active)")
      .order("published_at", { ascending: false })
      .limit(limit)
      .returns<SignalRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toSignal(row)));
  }

  async listByRunId(
    runId: string,
    limit = 20,
  ): Promise<Result<Signal[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<SignalRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toSignal(row)));
  }

  async findLatestPublished(): Promise<Result<Signal | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("report_status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle<SignalRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toSignal(data) : null);
  }

  async listByAsset(
    asset: string,
    limit = 50,
  ): Promise<Result<Signal[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("asset", asset)
      .order("published_at", { ascending: false })
      .limit(limit)
      .returns<SignalRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toSignal(row)));
  }
}
