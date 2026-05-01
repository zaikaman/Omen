import { err, ok, type Result } from "@omen/shared";

import { BaseRepository, type RepositoryError } from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

export type CopytradeTradeStatus = "queued" | "open" | "closed" | "failed" | "skipped";

export type CopytradeTrade = {
  id: string;
  enrollmentId: string;
  walletAddress: string;
  signalId: string | null;
  asset: string;
  direction: "LONG" | "SHORT";
  status: CopytradeTradeStatus;
  orderId: string | null;
  takeProfitOrderId: string | null;
  stopLossOrderId: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  quantity: number | null;
  leverage: number | null;
  notionalUsd: number | null;
  pnlUsd: number | null;
  pnlPercent: number | null;
  openedAt: string | null;
  closedAt: string | null;
  lastError: string | null;
  executionMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type CopytradeTradeRow = {
  id: string;
  enrollment_id: string;
  wallet_address: string;
  signal_id: string | null;
  asset: string;
  direction: "LONG" | "SHORT";
  status: CopytradeTradeStatus;
  order_id: string | null;
  take_profit_order_id: string | null;
  stop_loss_order_id: string | null;
  entry_price: number | string | null;
  exit_price: number | string | null;
  quantity: number | string | null;
  leverage: number | string | null;
  notional_usd: number | string | null;
  pnl_usd: number | string | null;
  pnl_percent: number | string | null;
  opened_at: string | null;
  closed_at: string | null;
  last_error: string | null;
  execution_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type CopytradeTradeInsert = Omit<CopytradeTradeRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type CopytradeTradeUpdate = Partial<CopytradeTradeInsert>;

const toNumber = (value: number | string | null): number | null => {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTrade = (row: CopytradeTradeRow): CopytradeTrade => ({
  id: row.id,
  enrollmentId: row.enrollment_id,
  walletAddress: row.wallet_address,
  signalId: row.signal_id,
  asset: row.asset,
  direction: row.direction,
  status: row.status,
  orderId: row.order_id,
  takeProfitOrderId: row.take_profit_order_id,
  stopLossOrderId: row.stop_loss_order_id,
  entryPrice: toNumber(row.entry_price),
  exitPrice: toNumber(row.exit_price),
  quantity: toNumber(row.quantity),
  leverage: toNumber(row.leverage),
  notionalUsd: toNumber(row.notional_usd),
  pnlUsd: toNumber(row.pnl_usd),
  pnlPercent: toNumber(row.pnl_percent),
  openedAt: normalizeDatabaseTimestamp(row.opened_at),
  closedAt: normalizeDatabaseTimestamp(row.closed_at),
  lastError: row.last_error,
  executionMetadata: row.execution_metadata,
  createdAt: normalizeDatabaseTimestamp(row.created_at) ?? row.created_at,
  updatedAt: normalizeDatabaseTimestamp(row.updated_at) ?? row.updated_at,
});

export type CreateCopytradeTradeInput = {
  enrollmentId: string;
  walletAddress: string;
  signalId: string | null;
  asset: string;
  direction: "LONG" | "SHORT";
  status: CopytradeTradeStatus;
  orderId?: string | null;
  takeProfitOrderId?: string | null;
  stopLossOrderId?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  quantity?: number | null;
  leverage?: number | null;
  notionalUsd?: number | null;
  pnlUsd?: number | null;
  pnlPercent?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  lastError?: string | null;
  executionMetadata?: Record<string, unknown> | null;
};

const toInsertRow = (trade: CreateCopytradeTradeInput): CopytradeTradeInsert => ({
  enrollment_id: trade.enrollmentId,
  wallet_address: trade.walletAddress.toLowerCase(),
  signal_id: trade.signalId,
  asset: trade.asset,
  direction: trade.direction,
  status: trade.status,
  order_id: trade.orderId ?? null,
  take_profit_order_id: trade.takeProfitOrderId ?? null,
  stop_loss_order_id: trade.stopLossOrderId ?? null,
  entry_price: trade.entryPrice ?? null,
  exit_price: trade.exitPrice ?? null,
  quantity: trade.quantity ?? null,
  leverage: trade.leverage ?? null,
  notional_usd: trade.notionalUsd ?? null,
  pnl_usd: trade.pnlUsd ?? null,
  pnl_percent: trade.pnlPercent ?? null,
  opened_at: trade.openedAt ?? null,
  closed_at: trade.closedAt ?? null,
  last_error: trade.lastError ?? null,
  execution_metadata: trade.executionMetadata ?? null,
});

const toUpdateRow = (
  patch: Partial<CreateCopytradeTradeInput>,
): CopytradeTradeUpdate => ({
  enrollment_id: patch.enrollmentId,
  wallet_address: patch.walletAddress?.toLowerCase(),
  signal_id: patch.signalId,
  asset: patch.asset,
  direction: patch.direction,
  status: patch.status,
  order_id: patch.orderId,
  take_profit_order_id: patch.takeProfitOrderId,
  stop_loss_order_id: patch.stopLossOrderId,
  entry_price: patch.entryPrice,
  exit_price: patch.exitPrice,
  quantity: patch.quantity,
  leverage: patch.leverage,
  notional_usd: patch.notionalUsd,
  pnl_usd: patch.pnlUsd,
  pnl_percent: patch.pnlPercent,
  opened_at: patch.openedAt,
  closed_at: patch.closedAt,
  last_error: patch.lastError,
  execution_metadata: patch.executionMetadata,
  updated_at: new Date().toISOString(),
});

export class CopytradeTradesRepository extends BaseRepository<
  CopytradeTradeRow,
  CopytradeTradeInsert,
  CopytradeTradeUpdate
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "copytrade_trades");
  }

  async listByWallet(
    walletAddress: string,
    limit = 50,
  ): Promise<Result<CopytradeTrade[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<CopytradeTradeRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toTrade(row)));
  }

  async findByEnrollmentAndSignal(
    enrollmentId: string,
    signalId: string,
  ): Promise<Result<CopytradeTrade | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .eq("signal_id", signalId)
      .limit(1)
      .maybeSingle<CopytradeTradeRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toTrade(data) : null);
  }

  async listOpenByEnrollment(
    enrollmentId: string,
    limit = 50,
  ): Promise<Result<CopytradeTrade[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .in("status", ["queued", "open"])
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<CopytradeTradeRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toTrade(row)));
  }

  async createTrade(
    trade: CreateCopytradeTradeInput,
  ): Promise<Result<CopytradeTrade, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(trade));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toTrade(inserted.value));
  }

  async updateTrade(
    tradeId: string,
    patch: Partial<CreateCopytradeTradeInput>,
  ): Promise<Result<CopytradeTrade, RepositoryError>> {
    const updated = await this.updateById(tradeId, toUpdateRow(patch));

    if (!updated.ok) {
      return updated;
    }

    return ok(toTrade(updated.value));
  }
}
