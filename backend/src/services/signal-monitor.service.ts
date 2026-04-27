import { BinanceMarketService, CoinGeckoMarketService } from "@omen/market-data";
import {
  SignalsRepository,
  createSupabaseServiceRoleClient,
  type RepositoryError,
} from "@omen/db";
import { ok, type Result, type Signal } from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import type { Logger } from "../bootstrap/logger.js";

type MonitorEnv = Pick<BackendEnv, "supabase" | "providers">;

export type SignalMonitorResult = {
  checked: number;
  updated: number;
  closed: number;
  errors: string[];
};

const RISK_PER_TRADE_PERCENT = 1;

const isPersistenceConfigured = (env: MonitorEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const isActionable = (
  signal: Signal,
): signal is Signal & { direction: "LONG" | "SHORT" } =>
  signal.direction === "LONG" || signal.direction === "SHORT";

const roundMetric = (value: number) => Number(value.toFixed(4));

export const calculateSignalPnL = (input: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  currentPrice: number;
}) => {
  const isLong = input.direction === "LONG";
  const risk = isLong
    ? input.entryPrice - input.stopLoss
    : input.stopLoss - input.entryPrice;
  const reward = isLong
    ? input.targetPrice - input.entryPrice
    : input.entryPrice - input.targetPrice;
  const riskReward = risk > 0 ? reward / risk : 1;
  const tpHit = isLong
    ? input.currentPrice >= input.targetPrice
    : input.currentPrice <= input.targetPrice;
  const slHit = isLong
    ? input.currentPrice <= input.stopLoss
    : input.currentPrice >= input.stopLoss;

  if (tpHit) {
    return {
      status: "tp_hit" as const,
      pnlPercent: roundMetric(RISK_PER_TRADE_PERCENT * riskReward),
      riskReward: roundMetric(riskReward),
      closed: true,
    };
  }

  if (slHit) {
    return {
      status: "sl_hit" as const,
      pnlPercent: -RISK_PER_TRADE_PERCENT,
      riskReward: roundMetric(riskReward),
      closed: true,
    };
  }

  const priceMove = isLong
    ? input.currentPrice - input.entryPrice
    : input.entryPrice - input.currentPrice;
  const currentR = risk > 0 ? priceMove / risk : 0;

  return {
    status: "active" as const,
    pnlPercent: roundMetric(currentR * RISK_PER_TRADE_PERCENT),
    riskReward: roundMetric(riskReward),
    closed: false,
  };
};

export class SignalMonitorService {
  private readonly binance = new BinanceMarketService();

  private readonly coingecko: CoinGeckoMarketService;

  private readonly repository: SignalsRepository | null;

  constructor(
    private readonly input: {
      env: MonitorEnv;
      logger: Logger;
    },
  ) {
    this.coingecko = new CoinGeckoMarketService({
      apiKey: input.env.providers.coinGeckoApiKeys[0],
    });

    if (!isPersistenceConfigured(input.env)) {
      this.repository = null;
      return;
    }

    const client = createSupabaseServiceRoleClient({
      url: input.env.supabase.url ?? "",
      anonKey: input.env.supabase.anonKey ?? input.env.supabase.serviceRoleKey ?? "",
      serviceRoleKey: input.env.supabase.serviceRoleKey ?? "",
      schema: input.env.supabase.schema,
    });

    this.repository = new SignalsRepository(client);
  }

  async checkActiveSignals(limit = 50): Promise<Result<SignalMonitorResult, RepositoryError>> {
    if (!this.repository) {
      return ok({ checked: 0, updated: 0, closed: 0, errors: [] });
    }

    const signals = await this.repository.listTrackableSignals(limit);

    if (!signals.ok) {
      return signals;
    }

    const result: SignalMonitorResult = {
      checked: signals.value.length,
      updated: 0,
      closed: 0,
      errors: [],
    };

    for (const signal of signals.value) {
      if (!isActionable(signal)) {
        continue;
      }

      const updateResult = await this.updateSignal(signal);

      if (!updateResult.ok) {
        result.errors.push(`${signal.id}: ${updateResult.error.message}`);
        continue;
      }

      if (updateResult.value.updated) {
        result.updated += 1;
      }

      if (updateResult.value.closed) {
        result.closed += 1;
      }
    }

    this.input.logger.info(
      `Signal monitor checked ${result.checked.toString()} signals, updated ${result.updated.toString()}, closed ${result.closed.toString()}.`,
    );

    return ok(result);
  }

  private async updateSignal(signal: Signal): Promise<
    Result<{ updated: boolean; closed: boolean }, RepositoryError>
  > {
    if (
      !this.repository ||
      !signal.entryPrice ||
      !signal.targetPrice ||
      !signal.stopLoss ||
      !isActionable(signal)
    ) {
      return ok({ updated: false, closed: false });
    }

    const currentPrice = await this.fetchCurrentPrice(signal.asset);

    if (currentPrice === null) {
      this.input.logger.warn(`Could not fetch current price for ${signal.asset}.`);
      return ok({ updated: false, closed: false });
    }

    const calculated = calculateSignalPnL({
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      targetPrice: signal.targetPrice,
      stopLoss: signal.stopLoss,
      currentPrice,
    });
    const now = new Date().toISOString();
    const update = await this.repository.updateSignal(signal.id, {
      currentPrice,
      pnlPercent: calculated.pnlPercent,
      riskReward: signal.riskReward ?? calculated.riskReward,
      signalStatus: calculated.status,
      closedAt: calculated.closed ? (signal.closedAt ?? now) : null,
      priceUpdatedAt: now,
      updatedAt: now,
    });

    if (!update.ok) {
      return update;
    }

    return ok({ updated: true, closed: calculated.closed });
  }

  private async fetchCurrentPrice(asset: string) {
    const binance = await this.binance.getSnapshot(asset);

    if (binance.ok) {
      return binance.value.price;
    }

    const coingecko = await this.coingecko.getAssetSnapshot(asset);

    if (coingecko.ok) {
      return coingecko.value.price;
    }

    this.input.logger.warn(
      `Price lookup failed for ${asset}: ${binance.error.message}; ${coingecko.error.message}`,
    );

    return null;
  }
}
