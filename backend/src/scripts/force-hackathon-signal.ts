import { randomUUID } from "node:crypto";

import { BinanceMarketService } from "@omen/market-data";
import {
  OutboundPostsRepository,
  RunsRepository,
  SignalsRepository,
  createSupabaseServiceRoleClient,
} from "@omen/db";
import { TRADEABLE_SYMBOLS, runSchema, signalSchema, type Signal } from "@omen/shared";

import { createBackendEnv } from "../bootstrap/env.js";
import { createLogger } from "../bootstrap/logger.js";
import { PostPublisher } from "../publishers/post-publisher.js";
import { PostResultRecorder } from "../publishers/post-result-recorder.js";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode.js";

const FORCE_FLAG = "HACKATHON_FORCE_SIGNAL";
const POST_FLAG = "HACKATHON_FORCE_POST_TO_X";
const DIRECTION_ENV = "HACKATHON_FORCE_DIRECTION";
const SYMBOL_ENV = "HACKATHON_FORCE_SYMBOL";
const LOOKBACK_SYMBOL_COUNT = 20;
const MIN_STOP_DISTANCE_PERCENT = 0.03;
const REWARD_MULTIPLE = 2.2;

type ForcedDirection = "LONG" | "SHORT";

const parseDirection = (value: string | undefined): ForcedDirection | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "LONG" || normalized === "SHORT") {
    return normalized;
  }

  throw new Error(`${DIRECTION_ENV} must be LONG or SHORT when provided.`);
};

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const calculateAtr = (
  candles: Array<{ high: number; low: number; close: number }>,
  period = 14,
) => {
  if (candles.length <= period) {
    throw new Error(`ATR requires more than ${period.toString()} candles.`);
  }

  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index]?.close ?? candle.close;

    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });

  return average(trueRanges.slice(-period));
};

const createRepositories = () => {
  const env = createBackendEnv();

  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Supabase service-role config is required to create a forced signal.");
  }

  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url,
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
    serviceRoleKey: env.supabase.serviceRoleKey,
    schema: env.supabase.schema,
  });

  return {
    env,
    logger: createLogger(env),
    posts: new OutboundPostsRepository(client),
    runs: new RunsRepository(client),
    signals: new SignalsRepository(client),
  };
};

const selectSignalTarget = async (input: {
  market: BinanceMarketService;
  signals: SignalsRepository;
  requestedDirection: ForcedDirection | null;
  requestedSymbol: string | null;
}) => {
  const activeSymbols = await input.signals.listActiveTradeSymbols();

  if (!activeSymbols.ok) {
    throw new Error(`Failed to load active trade symbols: ${activeSymbols.error.message}`);
  }

  const activeSet = new Set(activeSymbols.value.map((symbol) => symbol.toUpperCase()));
  const universe = TRADEABLE_SYMBOLS.slice(0, LOOKBACK_SYMBOL_COUNT).filter(
    (symbol) => !activeSet.has(symbol.toUpperCase()),
  );
  const requestedSymbol = input.requestedSymbol?.trim().toUpperCase() ?? null;
  const symbols = requestedSymbol ? [requestedSymbol] : universe;
  const snapshots = await input.market.getSnapshots(symbols);

  if (!snapshots.ok) {
    throw new Error(`Failed to load live market snapshots: ${snapshots.error.message}`);
  }

  const ranked = snapshots.value
    .filter((snapshot) => snapshot.change24hPercent !== null)
    .sort((a, b) => (b.change24hPercent ?? 0) - (a.change24hPercent ?? 0));

  if (ranked.length === 0) {
    throw new Error("No live snapshots with 24h change were available.");
  }

  const direction =
    input.requestedDirection ?? (average(ranked.map((snapshot) => snapshot.change24hPercent ?? 0)) >= 0
      ? "LONG"
      : "SHORT");
  const selected =
    requestedSymbol
      ? ranked.find((snapshot) => snapshot.symbol.toUpperCase() === requestedSymbol)
      : direction === "LONG"
        ? ranked[0]
        : ranked[ranked.length - 1];

  if (!selected) {
    throw new Error(`No live snapshot found for requested symbol ${requestedSymbol ?? "auto"}.`);
  }

  return {
    direction,
    snapshot: selected,
    breadth: {
      sampledSymbols: ranked.length,
      averageChange24hPercent: average(ranked.map((snapshot) => snapshot.change24hPercent ?? 0)),
      greenCount: ranked.filter((snapshot) => (snapshot.change24hPercent ?? 0) > 0).length,
      redCount: ranked.filter((snapshot) => (snapshot.change24hPercent ?? 0) < 0).length,
    },
  };
};

const buildForcedSignal = async (input: {
  market: BinanceMarketService;
  runId: string;
  direction: ForcedDirection;
  symbol: string;
  currentPrice: number;
  change24hPercent: number | null;
  breadth: {
    sampledSymbols: number;
    averageChange24hPercent: number;
    greenCount: number;
    redCount: number;
  };
}): Promise<Signal> => {
  const candles = await input.market.getCandles({
    symbol: input.symbol,
    interval: "4h",
    limit: 60,
  });

  if (!candles.ok) {
    throw new Error(`Failed to load live candles for ${input.symbol}: ${candles.error.message}`);
  }

  const atr = calculateAtr(candles.value);
  const atrDistancePercent = atr / input.currentPrice;
  const stopDistancePercent = Math.max(MIN_STOP_DISTANCE_PERCENT, atrDistancePercent * 1.5);
  const entryPrice = input.currentPrice;
  const stopLoss =
    input.direction === "LONG"
      ? entryPrice * (1 - stopDistancePercent)
      : entryPrice * (1 + stopDistancePercent);
  const targetPrice =
    input.direction === "LONG"
      ? entryPrice * (1 + stopDistancePercent * REWARD_MULTIPLE)
      : entryPrice * (1 - stopDistancePercent * REWARD_MULTIPLE);
  const timestamp = new Date().toISOString();
  const signalId = `signal-${input.runId}`;

  return signalSchema.parse({
    id: signalId,
    runId: input.runId,
    candidateId: `forced-${input.symbol.toLowerCase()}-${input.runId}`,
    asset: input.symbol,
    direction: input.direction,
    confidence: 80,
    orderType: "market",
    tradingStyle: "day_trade",
    expectedDuration: "4-24 hours",
    currentPrice: entryPrice,
    entryPrice,
    targetPrice,
    stopLoss,
    signalStatus: "active",
    pnlPercent: null,
    closedAt: null,
    priceUpdatedAt: timestamp,
    riskReward: REWARD_MULTIPLE,
    entryZone: {
      low: entryPrice,
      high: entryPrice,
      rationale: "Hackathon forced-signal script used the live market price as entry.",
    },
    invalidation: {
      low: stopLoss,
      high: stopLoss,
      rationale: "Stop derived from live 4h ATR with minimum distance guard.",
    },
    targets: [{ label: "TP1", price: targetPrice }],
    whyNow: [
      `Hackathon forced signal for ${input.symbol} ${input.direction}.`,
      `Live 24h change: ${input.change24hPercent?.toFixed(2) ?? "n/a"}%.`,
      `Market breadth sample: ${input.breadth.greenCount.toString()} green / ${input.breadth.redCount.toString()} red across ${input.breadth.sampledSymbols.toString()} symbols, average ${input.breadth.averageChange24hPercent.toFixed(2)}%.`,
    ].join(" "),
    confluences: [
      "Live Binance futures snapshot was available.",
      "Entry, stop, and target were derived from live market price and 4h ATR.",
    ],
    uncertaintyNotes:
      "Hackathon forced-signal utility used live market data with an operator-requested accelerated path. Treat as a demo signal rather than a full swarm-approved thesis.",
    missingDataNotes:
      "Accelerated hackathon path did not produce the normal full research bundle.",
    criticDecision: "approved",
    reportStatus: "published",
    finalReportRefId: null,
    proofRefIds: [],
    disclaimer:
      "Omen market intelligence is for informational purposes only and is not financial advice.",
    publishedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
};

const run = async () => {
  if (process.env[FORCE_FLAG] !== "1") {
    throw new Error(`Refusing to create a forced signal unless ${FORCE_FLAG}=1 is set.`);
  }

  const { env, logger, posts, runs, signals } = createRepositories();
  const market = new BinanceMarketService();
  const mode = getRuntimeModeFlags(env.runtimeMode);
  const requestedDirection = parseDirection(process.env[DIRECTION_ENV]);
  const requestedSymbol = process.env[SYMBOL_ENV] ?? null;
  const runId = `hackathon-forced-${Date.now().toString()}-${randomUUID()}`;
  const selected = await selectSignalTarget({
    market,
    signals,
    requestedDirection,
    requestedSymbol,
  });
  const signal = await buildForcedSignal({
    market,
    runId,
    direction: selected.direction,
    symbol: selected.snapshot.symbol.toUpperCase(),
    currentPrice: selected.snapshot.price,
    change24hPercent: selected.snapshot.change24hPercent,
    breadth: selected.breadth,
  });
  const timestamp = new Date().toISOString();
  const runRecord = runSchema.parse({
    id: runId,
    mode: mode.mode,
    status: "completed",
    marketBias: selected.direction,
    startedAt: timestamp,
    completedAt: timestamp,
    triggeredBy: "system",
    activeCandidateCount: 1,
    currentCheckpointRefId: null,
    finalSignalId: null,
    finalIntelId: null,
    failureReason: null,
    outcome: null,
    configSnapshot: {
      script: "force-hackathon-signal",
      forceFlag: FORCE_FLAG,
      requestedDirection,
      requestedSymbol,
      bypassedScanner: true,
      bypassedCritic: true,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const createdRun = await runs.createRun(runRecord);

  if (!createdRun.ok) {
    throw new Error(`Failed to create forced run: ${createdRun.error.message}`);
  }

  const createdSignal = await signals.createSignal(signal);

  if (!createdSignal.ok) {
    throw new Error(`Failed to create forced signal: ${createdSignal.error.message}`);
  }

  const updatedRun = await runs.updateRun(runId, {
    finalSignalId: createdSignal.value.id,
    outcome: {
      outcomeType: "signal",
      summary: `Forced hackathon ${signal.asset} ${signal.direction} signal created from live market data.`,
      signalId: createdSignal.value.id,
      intelId: null,
    },
    updatedAt: new Date().toISOString(),
  });

  if (!updatedRun.ok) {
    throw new Error(`Failed to update forced run with signal reference: ${updatedRun.error.message}`);
  }

  let postResult: Awaited<ReturnType<PostPublisher["publishSignal"]>> | null = null;

  if (process.env[POST_FLAG] === "1") {
    const publisher = new PostPublisher({
      env,
      posts,
      logger,
    });
    const recorder = new PostResultRecorder({
      runs,
    });

    postResult = await publisher.publishSignal({
      ...createdSignal.value,
      whyNow: `Hackathon demo signal generated from live market data. ${createdSignal.value.whyNow}`,
    });

    await recorder.recordPostResult({
      run: updatedRun.value,
      post: postResult.post,
    });
  }

  console.log(
    JSON.stringify(
      {
        runId,
        signalId: createdSignal.value.id,
        asset: createdSignal.value.asset,
        direction: createdSignal.value.direction,
        confidence: createdSignal.value.confidence,
        entryPrice: createdSignal.value.entryPrice,
        targetPrice: createdSignal.value.targetPrice,
        stopLoss: createdSignal.value.stopLoss,
        riskReward: createdSignal.value.riskReward,
        postedToX: postResult?.post.status === "posted",
        postStatus: postResult?.post.status ?? null,
        publishedUrl: postResult?.post.publishedUrl ?? null,
        hackathonForcedPath: true,
      },
      null,
      2,
    ),
  );
};

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
