import type { Request, Response } from "express";

import { ChartImageService } from "@omen/agents";
import { SignalsRepository, createSupabaseServiceRoleClient } from "@omen/db";
import { BinanceMarketService } from "@omen/market-data";
import {
  SIGNAL_DIRECTION_VALUES,
  SIGNAL_STATUS_VALUES,
  type Signal,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import {
  presentSignalDetail,
  presentSignalFeed,
} from "../presenters/signals.presenter.js";

const parseLimit = (value: unknown, defaultLimit: number) => {
  if (typeof value !== "string") {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : defaultLimit;
};

const SIGNAL_SORT_VALUES = [
  "newest",
  "oldest",
  "confidence-high",
  "confidence-low",
  "pnl-high",
  "pnl-low",
] as const;

type SignalSort = (typeof SIGNAL_SORT_VALUES)[number];

const parsePage = (value: unknown) => {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const parseSort = (value: unknown): SignalSort =>
  typeof value === "string" &&
  SIGNAL_SORT_VALUES.includes(value as SignalSort)
    ? (value as SignalSort)
    : "newest";

const parseStatus = (value: unknown): Signal["signalStatus"] | null =>
  typeof value === "string" &&
  value !== "all" &&
  SIGNAL_STATUS_VALUES.includes(value as NonNullable<Signal["signalStatus"]>)
    ? (value as Signal["signalStatus"])
    : null;

const parseDirection = (value: unknown): Signal["direction"] | null => {
  if (typeof value !== "string" || value === "all") {
    return null;
  }

  const direction = value.toUpperCase();
  return SIGNAL_DIRECTION_VALUES.includes(direction as Signal["direction"])
    ? (direction as Signal["direction"])
    : null;
};

const createRepository = (env: BackendEnv) => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return null;
  }

  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url,
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
    serviceRoleKey: env.supabase.serviceRoleKey,
    schema: env.supabase.schema,
  });

  return new SignalsRepository(client);
};

const parseChartTimeframe = (value: unknown): "15m" | "1h" | "4h" =>
  value === "1h" || value === "4h" ? value : "15m";

const resolvePrimaryTarget = (signal: Signal) =>
  signal.targetPrice ?? signal.targets[0]?.price ?? null;

const resolveEntryPrice = (signal: Signal) =>
  signal.entryPrice ?? signal.entryZone?.low ?? null;

const resolveStopLoss = (signal: Signal) =>
  signal.stopLoss ?? signal.invalidation?.low ?? null;

const resolveActionableDirection = (signal: Signal) =>
  signal.direction === "LONG" || signal.direction === "SHORT"
    ? signal.direction
    : null;

export const createSignalFeedController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);
    const limit = parseLimit(req.query.limit, 20);
    const page = parsePage(req.query.page);

    if (!repository) {
      res.json({
        success: true,
        data: presentSignalFeed({ items: [], total: 0, nextCursor: null }),
      });
      return;
    }

    const listed = await repository.listSignalHistory({
      direction: parseDirection(req.query.direction),
      limit,
      offset: (page - 1) * limit,
      query: typeof req.query.query === "string" ? req.query.query : null,
      sortBy: parseSort(req.query.sort),
      status: parseStatus(req.query.status),
    });

    if (!listed.ok) {
      res.status(500).json({ success: false, error: listed.error.message });
      return;
    }

    const nextCursor =
      page * limit < listed.value.total ? String(page + 1) : null;

    res.json({
      success: true,
      data: presentSignalFeed({
        items: listed.value.items,
        total: listed.value.total,
        nextCursor,
      }),
    });
  };

export const createSignalDetailController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.status(404).json({
        success: false,
        error: "Signal persistence is not configured.",
      });
      return;
    }

    const signalId = typeof req.params.id === "string" ? req.params.id : "";
    const found = await repository.findSignalById(signalId);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    if (!found.value) {
      res.status(404).json({ success: false, error: "Signal not found." });
      return;
    }

    res.json({
      success: true,
      data: presentSignalDetail(found.value),
    });
  };

export const createSignalChartController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    void env;
    const repository = createRepository(env);

    if (!repository) {
      res.status(404).json({
        success: false,
        error: "Signal persistence is not configured.",
      });
      return;
    }

    const signalId = typeof req.params.id === "string" ? req.params.id : "";
    const found = await repository.findSignalById(signalId);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    if (!found.value) {
      res.status(404).json({ success: false, error: "Signal not found." });
      return;
    }

    const signal = found.value;
    const timeframe = parseChartTimeframe(req.query.timeframe);
    const marketData = new BinanceMarketService();
    const candles = await marketData.getCandles({
      symbol: signal.asset,
      interval: timeframe,
      limit: 120,
    });

    if (!candles.ok) {
      res.status(503).json({
        success: false,
        error: candles.error.message,
      });
      return;
    }

    const actionableDirection = resolveActionableDirection(signal);
    const chart = await new ChartImageService().generateCandlestickChart({
      symbol: signal.asset,
      timeframe,
      candles: candles.value,
      width: 1280,
      height: 720,
      showIndicators: false,
      tradeLevels: actionableDirection
        ? {
            direction: actionableDirection,
            entry: resolveEntryPrice(signal),
            target: resolvePrimaryTarget(signal),
            stopLoss: resolveStopLoss(signal),
          }
        : undefined,
    });

    const imageBuffer = Buffer.from(chart.base64, "base64");
    res.setHeader("Content-Type", chart.mimeType);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("X-Omen-Chart-Timeframe", timeframe);
    res.send(imageBuffer);
  };

export const createSignalCandlesController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    void env;
    const repository = createRepository(env);

    if (!repository) {
      res.status(404).json({
        success: false,
        error: "Signal persistence is not configured.",
      });
      return;
    }

    const signalId = typeof req.params.id === "string" ? req.params.id : "";
    const found = await repository.findSignalById(signalId);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    if (!found.value) {
      res.status(404).json({ success: false, error: "Signal not found." });
      return;
    }

    const timeframe = parseChartTimeframe(req.query.timeframe);
    const marketData = new BinanceMarketService();
    const candles = await marketData.getCandles({
      symbol: found.value.asset,
      interval: timeframe,
      limit: 180,
    });

    if (!candles.ok) {
      res.status(503).json({
        success: false,
        error: candles.error.message,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        symbol: found.value.asset,
        timeframe,
        candles: candles.value,
      },
    });
  };
