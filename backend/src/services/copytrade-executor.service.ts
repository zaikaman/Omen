import {
  CopytradeEnrollmentsRepository,
  CopytradeTradesRepository,
  SignalsRepository,
  createSupabaseServiceRoleClient,
  type CopytradeEnrollment,
  type CopytradeTrade,
  type CreateCopytradeTradeInput,
} from "@omen/db";
import { type Signal } from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import type { Logger } from "../bootstrap/logger.js";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode.js";
import { decryptAgentKey } from "./copytrade-crypto.js";
import { HyperliquidCopytradeService } from "./hyperliquid-copytrade-service.js";

type CopytradeExecutorResult = {
  signals: number;
  enrollments: number;
  submitted: number;
  skipped: number;
  synced: number;
  errors: string[];
};

const MINIMUM_ACCOUNT_VALUE_USD = 100;
const DEFAULT_SIGNAL_LIMIT = 25;
const DEFAULT_ENROLLMENT_LIMIT = 250;
const DEFAULT_INTERVAL_MS = 20_000;
const MAX_MARKET_ENTRY_DEVIATION_PERCENT = 5;

const isPersistenceConfigured = (env: BackendEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const isActionableSignal = (
  signal: Signal,
): signal is Signal & {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
} =>
  (signal.direction === "LONG" || signal.direction === "SHORT") &&
  typeof signal.entryPrice === "number" &&
  typeof signal.targetPrice === "number" &&
  typeof signal.stopLoss === "number";

const normalizeAsset = (asset: string) =>
  asset.toUpperCase().replace(/USDT$/, "").replace(/-PERP$/, "").trim();

const isValidDirectionalSetup = (signal: Signal & {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
}) =>
  signal.direction === "LONG"
    ? signal.targetPrice > signal.entryPrice && signal.stopLoss < signal.entryPrice
    : signal.targetPrice < signal.entryPrice && signal.stopLoss > signal.entryPrice;

const calculateRiskSizedNotional = (input: {
  equity: number;
  entryPrice: number;
  stopLoss: number;
  riskPerSignalPercent: number;
  maxAllocationUsd: number;
}) => {
  const riskAmount = input.equity * (input.riskPerSignalPercent / 100);
  const stopDistance = Math.abs(input.entryPrice - input.stopLoss);

  if (stopDistance <= 0) {
    return 0;
  }

  const stopDistancePercent = stopDistance / input.entryPrice;
  const riskSizedNotional = riskAmount / stopDistancePercent;
  const allocationCap = input.maxAllocationUsd > 0 ? input.maxAllocationUsd : riskSizedNotional;

  return Math.max(0, Math.min(riskSizedNotional, allocationCap));
};

const calculatePnlPercent = (pnlUsd: number, notionalUsd: number | null) =>
  notionalUsd && notionalUsd > 0 ? (pnlUsd / notionalUsd) * 100 : null;

export class CopytradeExecutorService {
  private interval: NodeJS.Timeout | null = null;

  private running = false;

  private readonly repositories: {
    enrollments: CopytradeEnrollmentsRepository;
    trades: CopytradeTradesRepository;
    signals: SignalsRepository;
  } | null;

  constructor(
    private readonly input: {
      env: BackendEnv;
      logger: Logger;
    },
  ) {
    if (!isPersistenceConfigured(input.env)) {
      this.repositories = null;
      return;
    }

    const client = createSupabaseServiceRoleClient({
      url: input.env.supabase.url ?? "",
      anonKey: input.env.supabase.anonKey ?? input.env.supabase.serviceRoleKey ?? "",
      serviceRoleKey: input.env.supabase.serviceRoleKey ?? "",
      schema: input.env.supabase.schema,
    });

    this.repositories = {
      enrollments: new CopytradeEnrollmentsRepository(client),
      trades: new CopytradeTradesRepository(client),
      signals: new SignalsRepository(client),
    };
  }

  start(intervalMs = DEFAULT_INTERVAL_MS) {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.input.logger.error("Copytrade executor tick failed.", error);
      });
    }, intervalMs);

    void this.runOnce().catch((error: unknown) => {
      this.input.logger.error("Initial copytrade executor tick failed.", error);
    });
  }

  stop() {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  async runOnce(): Promise<CopytradeExecutorResult> {
    if (this.running) {
      return { signals: 0, enrollments: 0, submitted: 0, skipped: 0, synced: 0, errors: [] };
    }

    this.running = true;

    try {
      return await this.execute();
    } finally {
      this.running = false;
    }
  }

  private async execute(): Promise<CopytradeExecutorResult> {
    const result: CopytradeExecutorResult = {
      signals: 0,
      enrollments: 0,
      submitted: 0,
      skipped: 0,
      synced: 0,
      errors: [],
    };

    const runtimeMode = getRuntimeModeFlags(this.input.env.runtimeMode);

    if (
      !this.repositories ||
      !this.input.env.deferred.futuresEncryptionKey ||
      !runtimeMode.allowsExternalWrites
    ) {
      return result;
    }

    const [signalsResult, enrollmentsResult] = await Promise.all([
      this.repositories.signals.listTrackableSignals(DEFAULT_SIGNAL_LIMIT),
      this.repositories.enrollments.listActive(DEFAULT_ENROLLMENT_LIMIT),
    ]);

    if (!signalsResult.ok) {
      result.errors.push(signalsResult.error.message);
      return result;
    }

    if (!enrollmentsResult.ok) {
      result.errors.push(enrollmentsResult.error.message);
      return result;
    }

    const signals = signalsResult.value.filter(isActionableSignal);
    const enrollments = enrollmentsResult.value;
    result.signals = signals.length;
    result.enrollments = enrollments.length;

    for (const enrollment of enrollments) {
      const openTrades = await this.repositories.trades.listOpenByEnrollment(enrollment.id);

      if (!openTrades.ok) {
        if (
          signals.length === 0 &&
          openTrades.error.message.includes("copytrade_trades")
        ) {
          continue;
        }

        const message = `${enrollment.walletAddress}: ${openTrades.error.message}`;
        result.errors.push(message);
        this.input.logger.error("Copytrade executor could not load open trades.", message);
        continue;
      }

      if (signals.length === 0 && openTrades.value.length === 0) {
        continue;
      }

      const service = this.createHyperliquidService(enrollment);

      try {
        result.synced += await this.syncEnrollmentTrades(enrollment, service);

        for (const signal of signals) {
          const processed = await this.processSignalForEnrollment({
            enrollment,
            service,
            signal,
          });

          if (processed === "submitted") {
            result.submitted += 1;
          } else {
            result.skipped += 1;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown copytrade execution error.";
        result.errors.push(`${enrollment.walletAddress}: ${message}`);
        this.input.logger.error(`Copytrade executor failed for ${enrollment.walletAddress}.`, error);
        await this.repositories.enrollments.updateEnrollment(enrollment.id, {
          last_error: message,
        });
      } finally {
        await service.disconnect();
      }
    }

    if (result.submitted > 0 || result.synced > 0 || result.errors.length > 0) {
      this.input.logger.info(
        `Copytrade executor: signals=${result.signals.toString()} enrollments=${result.enrollments.toString()} submitted=${result.submitted.toString()} synced=${result.synced.toString()} errors=${result.errors.length.toString()}`,
      );
    }

    return result;
  }

  private createHyperliquidService(enrollment: CopytradeEnrollment) {
    const encryptionKey = this.input.env.deferred.futuresEncryptionKey;

    if (!encryptionKey) {
      throw new Error("FUTURES_ENCRYPTION_KEY is required for copytrade execution.");
    }

    return new HyperliquidCopytradeService({
      agentPrivateKey: decryptAgentKey(enrollment.encryptedAgentPrivateKey, encryptionKey),
      walletAddress: enrollment.walletAddress,
      chain: enrollment.hyperliquidChain,
      logger: this.input.logger,
    });
  }

  private async processSignalForEnrollment(input: {
    enrollment: CopytradeEnrollment;
    service: HyperliquidCopytradeService;
    signal: Signal & {
      direction: "LONG" | "SHORT";
      entryPrice: number;
      targetPrice: number;
      stopLoss: number;
    };
  }) {
    if (!this.repositories) {
      return "skipped" as const;
    }

    const { enrollment, signal, service } = input;
    const asset = normalizeAsset(signal.asset);
    const existing = await this.repositories.trades.findByEnrollmentAndSignal(
      enrollment.id,
      signal.id,
    );

    if (!existing.ok) {
      throw new Error(existing.error.message);
    }

    let retryTrade: CopytradeTrade | null = null;

    if (existing.value) {
      if (existing.value.status === "failed" && !existing.value.orderId) {
        retryTrade = existing.value;
      } else {
        return "skipped" as const;
      }
    }

    if (!isValidDirectionalSetup(signal)) {
      await this.recordSkipped(
        enrollment,
        signal,
        asset,
        "Signal target/stop are not valid for its direction.",
        retryTrade,
      );
      return "skipped" as const;
    }

    if (signal.direction === "LONG" && !enrollment.riskSettings.copyLongs) {
      await this.recordSkipped(enrollment, signal, asset, "Long copying is disabled.", retryTrade);
      return "skipped" as const;
    }

    if (signal.direction === "SHORT" && !enrollment.riskSettings.copyShorts) {
      await this.recordSkipped(enrollment, signal, asset, "Short copying is disabled.", retryTrade);
      return "skipped" as const;
    }

    if (
      enrollment.riskSettings.allowedAssets.length > 0 &&
      !enrollment.riskSettings.allowedAssets.includes(asset)
    ) {
      await this.recordSkipped(
        enrollment,
        signal,
        asset,
        `${asset} is not enabled in risk settings.`,
        retryTrade,
      );
      return "skipped" as const;
    }

    const openTrades = await this.repositories.trades.listOpenByEnrollment(enrollment.id);

    if (!openTrades.ok) {
      throw new Error(openTrades.error.message);
    }

    if (openTrades.value.length >= enrollment.riskSettings.maxOpenPositions) {
      await this.recordSkipped(
        enrollment,
        signal,
        asset,
        "Maximum open copied positions reached.",
        retryTrade,
      );
      return "skipped" as const;
    }

    if (openTrades.value.some((trade) => normalizeAsset(trade.asset) === asset)) {
      await this.recordSkipped(
        enrollment,
        signal,
        asset,
        `A copied ${asset} position is already open.`,
        retryTrade,
      );
      return "skipped" as const;
    }

    const tradable = await service.isAssetTradable(asset);

    if (!tradable.tradable) {
      await this.recordSkipped(
        enrollment,
        signal,
        asset,
        tradable.reason ?? `${asset} is not tradable on Hyperliquid.`,
        retryTrade,
      );
      return "skipped" as const;
    }

    const equity = await service.getAccountEquity(true);

    if (!Number.isFinite(equity) || equity < MINIMUM_ACCOUNT_VALUE_USD) {
      await this.recordSkipped(
        enrollment,
        signal,
        asset,
        `Hyperliquid account equity is below $${MINIMUM_ACCOUNT_VALUE_USD.toString()}.`,
        retryTrade,
      );
      return "skipped" as const;
    }

    if (signal.orderType !== "limit") {
      const currentPrice = await service.getPrice(asset);
      const deviationPercent = Math.abs((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;

      if (deviationPercent > MAX_MARKET_ENTRY_DEVIATION_PERCENT) {
        await this.recordSkipped(
        enrollment,
        signal,
        asset,
        `Current price is ${deviationPercent.toFixed(2)}% away from signal entry.`,
        retryTrade,
      );
      return "skipped" as const;
    }
    }

    const notionalUsd = calculateRiskSizedNotional({
      equity,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      riskPerSignalPercent: enrollment.riskSettings.riskPerSignalPercent,
      maxAllocationUsd: enrollment.riskSettings.maxAllocationUsd,
    });

    if (notionalUsd <= 0) {
      await this.recordSkipped(
        enrollment,
        signal,
        asset,
        "Calculated copied position size is zero.",
        retryTrade,
      );
      return "skipped" as const;
    }

    const maxLeverage = await service.getMaxLeverage(asset);
    const leverage = Math.max(
      1,
      Math.min(enrollment.riskSettings.maxLeverage, maxLeverage),
    );
    const order = await service
      .openBracketPosition({
        symbol: asset,
        side: signal.direction,
        notionalUsd,
        leverage,
        takeProfitPrice: signal.targetPrice,
        stopLossPrice: signal.stopLoss,
        entryPrice: signal.orderType === "limit" ? signal.entryPrice : undefined,
        orderType: signal.orderType === "limit" ? "limit" : "market",
      })
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : "Hyperliquid order submission failed.";
        await this.recordFailed(enrollment, signal, asset, message, retryTrade);
        return null;
      });

    if (!order) {
      return "skipped" as const;
    }
    const now = new Date().toISOString();
    const isOpen = Boolean(order.takeProfitOrderId && order.stopLossOrderId);
    const tradeInput = {
      enrollmentId: enrollment.id,
      walletAddress: enrollment.walletAddress,
      signalId: signal.id,
      asset,
      direction: signal.direction,
      status: isOpen ? "open" : "queued",
      orderId: order.entryOrderId,
      takeProfitOrderId: order.takeProfitOrderId,
      stopLossOrderId: order.stopLossOrderId,
      entryPrice: order.entryPrice,
      quantity: order.quantity,
      leverage: order.leverage,
      notionalUsd: order.notionalUsd,
      openedAt: isOpen ? now : null,
      executionMetadata: {
        entryOrder: order.entryOrder,
        takeProfitOrder: order.takeProfitOrder,
        stopLossOrder: order.stopLossOrder,
        targetPrice: signal.targetPrice,
        stopLoss: signal.stopLoss,
        orderType: signal.orderType ?? "market",
        signalPublishedAt: signal.publishedAt,
      },
    } satisfies CreateCopytradeTradeInput;
    const created = retryTrade
      ? await this.repositories.trades.updateTrade(retryTrade.id, tradeInput)
      : await this.repositories.trades.createTrade(tradeInput);

    if (!created.ok) {
      throw new Error(created.error.message);
    }

    return "submitted" as const;
  }

  private async syncEnrollmentTrades(
    enrollment: CopytradeEnrollment,
    service: HyperliquidCopytradeService,
  ) {
    if (!this.repositories) {
      return 0;
    }

    const openTrades = await this.repositories.trades.listOpenByEnrollment(enrollment.id);

    if (!openTrades.ok) {
      throw new Error(openTrades.error.message);
    }

    if (openTrades.value.length === 0) {
      return 0;
    }

    const [positions, fills] = await Promise.all([
      service.getPositions(true),
      service.getFills(100, true),
    ]);
    let synced = 0;

    for (const trade of openTrades.value) {
      const position = positions.find((candidate) => candidate.coin === normalizeAsset(trade.asset));

      if (position) {
        synced += await this.syncOpenPositionTrade({
          enrollment,
          service,
          trade,
          position,
        });
        continue;
      }

      if (trade.status === "open") {
        const closingFill = fills.find((fill) => {
          const fillOid = fill.oid.toString();
          return (
            normalizeAsset(fill.coin) === normalizeAsset(trade.asset) &&
            (fillOid === trade.takeProfitOrderId || fillOid === trade.stopLossOrderId)
          );
        });

        if (closingFill) {
          const pnlUsd = Number(closingFill.closedPnl);
          const exitPrice = Number(closingFill.px);
          const closed = await this.repositories.trades.updateTrade(trade.id, {
            status: "closed",
            exitPrice: Number.isFinite(exitPrice) ? exitPrice : trade.exitPrice,
            pnlUsd: Number.isFinite(pnlUsd) ? pnlUsd : trade.pnlUsd,
            pnlPercent: Number.isFinite(pnlUsd)
              ? calculatePnlPercent(pnlUsd, trade.notionalUsd)
              : trade.pnlPercent,
            closedAt: new Date(closingFill.time).toISOString(),
            lastError: null,
          });

          if (!closed.ok) {
            throw new Error(closed.error.message);
          }

          synced += 1;
        }
      }
    }

    return synced;
  }

  private async syncOpenPositionTrade(input: {
    enrollment: CopytradeEnrollment;
    service: HyperliquidCopytradeService;
    trade: CopytradeTrade;
    position: {
      entryPrice: number;
      quantity: number;
      positionValue: number;
      unrealizedPnl: number;
      leverage: number;
    };
  }) {
    if (!this.repositories) {
      return 0;
    }

    const { enrollment, service, trade, position } = input;
    let takeProfitOrderId = trade.takeProfitOrderId;
    let stopLossOrderId = trade.stopLossOrderId;
    const metadata = trade.executionMetadata ?? {};

    let bracketError: string | null = null;

    if (!takeProfitOrderId || !stopLossOrderId) {
      const targetPrice = Number(metadata.targetPrice);
      const stopLoss = Number(metadata.stopLoss);

      if (Number.isFinite(targetPrice) && Number.isFinite(stopLoss)) {
        const bracket = await service.placePositionTriggers({
          symbol: trade.asset,
          side: trade.direction,
          quantity: position.quantity,
          takeProfitPrice: targetPrice,
          stopLossPrice: stopLoss,
        }).catch((error: unknown) => {
          bracketError = error instanceof Error ? error.message : "Failed to attach bracket orders.";
          this.input.logger.error(
            `Failed to attach brackets for ${enrollment.walletAddress} ${trade.asset}.`,
            error,
          );
          return null;
        });

        takeProfitOrderId = bracket?.takeProfitOrderId ?? takeProfitOrderId;
        stopLossOrderId = bracket?.stopLossOrderId ?? stopLossOrderId;
      }
    }

    const updated = await this.repositories.trades.updateTrade(trade.id, {
      status: "open",
      takeProfitOrderId,
      stopLossOrderId,
      entryPrice: position.entryPrice || trade.entryPrice,
      quantity: position.quantity || trade.quantity,
      leverage: position.leverage || trade.leverage,
      notionalUsd: position.positionValue || trade.notionalUsd,
      pnlUsd: position.unrealizedPnl,
      pnlPercent: calculatePnlPercent(position.unrealizedPnl, position.positionValue),
      openedAt: trade.openedAt ?? new Date().toISOString(),
      lastError:
        bracketError ??
        (!takeProfitOrderId || !stopLossOrderId ? "Position is open without complete TP/SL orders." : null),
    });

    if (!updated.ok) {
      throw new Error(updated.error.message);
    }

    return 1;
  }

  private async recordSkipped(
    enrollment: CopytradeEnrollment,
    signal: Signal & { direction: "LONG" | "SHORT" },
    asset: string,
    reason: string,
    existingTrade: CopytradeTrade | null = null,
  ) {
    if (!this.repositories) {
      return;
    }

    const tradeInput = {
      enrollmentId: enrollment.id,
      walletAddress: enrollment.walletAddress,
      signalId: signal.id,
      asset,
      direction: signal.direction,
      status: "skipped",
      lastError: reason,
      executionMetadata: {
        reason,
        signalPublishedAt: signal.publishedAt,
      },
    } satisfies CreateCopytradeTradeInput;
    const created = existingTrade
      ? await this.repositories.trades.updateTrade(existingTrade.id, tradeInput)
      : await this.repositories.trades.createTrade(tradeInput);

    if (!created.ok) {
      throw new Error(created.error.message);
    }
  }

  private async recordFailed(
    enrollment: CopytradeEnrollment,
    signal: Signal & { direction: "LONG" | "SHORT" },
    asset: string,
    reason: string,
    existingTrade: CopytradeTrade | null = null,
  ) {
    if (!this.repositories) {
      return;
    }

    const tradeInput = {
      enrollmentId: enrollment.id,
      walletAddress: enrollment.walletAddress,
      signalId: signal.id,
      asset,
      direction: signal.direction,
      status: "failed",
      lastError: reason,
      executionMetadata: {
        reason,
        signalPublishedAt: signal.publishedAt,
      },
    } satisfies CreateCopytradeTradeInput;
    const created = existingTrade
      ? await this.repositories.trades.updateTrade(existingTrade.id, tradeInput)
      : await this.repositories.trades.createTrade(tradeInput);

    if (!created.ok) {
      throw new Error(created.error.message);
    }
  }
}
