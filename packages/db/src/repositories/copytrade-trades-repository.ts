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
  createdAt: normalizeDatabaseTimestamp(row.created_at) ?? row.created_at,
  updatedAt: normalizeDatabaseTimestamp(row.updated_at) ?? row.updated_at,
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
}
