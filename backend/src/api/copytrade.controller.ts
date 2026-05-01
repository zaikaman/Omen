import type { Request, Response } from "express";
import { Wallet } from "ethers";

import {
  CopytradeEnrollmentsRepository,
  CopytradeTradesRepository,
  createSupabaseServiceRoleClient,
  type CreateCopytradeTradeInput,
  type CopytradeTrade,
  type CopytradeRiskSettings,
} from "@omen/db";

import type { BackendEnv } from "../bootstrap/env.js";
import { encryptAgentKey } from "../services/copytrade-crypto.js";

const HYPERLIQUID_EXCHANGE_URLS: Record<HyperliquidChain, string> = {
  Mainnet: "https://api.hyperliquid.xyz/exchange",
  Testnet: "https://api.hyperliquid-testnet.xyz/exchange",
};
const HYPERLIQUID_INFO_URLS: Record<HyperliquidChain, string> = {
  Mainnet: "https://api.hyperliquid.xyz/info",
  Testnet: "https://api.hyperliquid-testnet.xyz/info",
};
const AGENT_NAME = "OmenCopy";
const MINIMUM_ACCOUNT_VALUE_USD = 100;
const DEFAULT_TRADE_PAGE_SIZE = 20;
const MAX_TRADE_PAGE_SIZE = 100;
const TRADE_STATS_HISTORY_LIMIT = 1_000;

type HyperliquidChain = "Mainnet" | "Testnet";
type PresentedTradeStatus = "queued" | "open" | "closed" | "failed" | "skipped";
type CopytradeRepositories = NonNullable<ReturnType<typeof createRepositories>>;
type HyperliquidPositionState = {
  coin?: string;
  szi?: string;
  entryPx?: string;
  positionValue?: string;
  unrealizedPnl?: string;
  leverage?: {
    value?: number;
  };
};
type HyperliquidClearinghouseState = {
  time?: number;
  marginSummary?: {
    accountValue?: string;
    totalMarginUsed?: string;
    totalNtlPos?: string;
    totalRawUsd?: string;
  };
  withdrawable?: string;
  assetPositions?: Array<{
    position?: HyperliquidPositionState;
  }>;
};
type HyperliquidFill = {
  closedPnl?: string;
  coin?: string;
  dir?: string;
  oid?: number;
  px?: string;
  time?: number;
};
type LiveHyperliquidPosition = {
  asset: string;
  direction: "LONG" | "SHORT";
  entryPrice: number | null;
  leverage: number | null;
  pnlUsd: number | null;
  positionValue: number | null;
  quantity: number;
};

const isAddress = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const isHexChainId = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x[a-fA-F0-9]+$/.test(value);

const parsePositiveInteger = (
  value: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
};

const parseHyperliquidChain = (value: unknown): HyperliquidChain =>
  value === "Testnet" ? "Testnet" : "Mainnet";

const normalizeAsset = (asset: string) =>
  asset.toUpperCase().replace(/USDT$/, "").replace(/-PERP$/, "").trim();

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculatePnlPercent = (pnlUsd: number | null, notionalUsd: number | null) =>
  pnlUsd !== null && notionalUsd && notionalUsd > 0 ? (pnlUsd / notionalUsd) * 100 : null;

const fetchHyperliquidInfo = async <T>(
  hyperliquidChain: HyperliquidChain,
  body: Record<string, unknown>,
) => {
  const response = await fetch(HYPERLIQUID_INFO_URLS[hyperliquidChain], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as T | null;

  if (!response.ok || !payload) {
    throw new Error(`Hyperliquid ${String(body.type)} lookup failed with status ${response.status.toString()}.`);
  }

  return payload;
};

const createRepositories = (env: BackendEnv) => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return null;
  }

  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url,
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
    serviceRoleKey: env.supabase.serviceRoleKey,
    schema: env.supabase.schema,
  });

  return {
    enrollments: new CopytradeEnrollmentsRepository(client),
    trades: new CopytradeTradesRepository(client),
  };
};

const parseRiskSettings = (input: unknown): CopytradeRiskSettings => {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const maxAllocationUsd = Number(value.maxAllocationUsd);
  const riskPerSignalPercent = Number(value.riskPerSignalPercent);
  const maxLeverage = Number(value.maxLeverage);
  const maxOpenPositions = Number(value.maxOpenPositions);
  const allowedAssets = Array.isArray(value.allowedAssets)
    ? value.allowedAssets
        .filter((asset): asset is string => typeof asset === "string")
        .map((asset) => asset.trim().toUpperCase())
        .filter(Boolean)
    : [];

  return {
    maxAllocationUsd: Number.isFinite(maxAllocationUsd) ? Math.max(0, maxAllocationUsd) : 0,
    riskPerSignalPercent: Number.isFinite(riskPerSignalPercent)
      ? Math.min(Math.max(riskPerSignalPercent, 0.1), 10)
      : 1,
    maxLeverage: Number.isFinite(maxLeverage) ? Math.min(Math.max(Math.floor(maxLeverage), 1), 50) : 5,
    maxOpenPositions: Number.isFinite(maxOpenPositions)
      ? Math.min(Math.max(Math.floor(maxOpenPositions), 1), 10)
      : 3,
    allowedAssets,
    copyLongs: value.copyLongs !== false,
    copyShorts: value.copyShorts !== false,
  };
};

const presentEnrollment = (enrollment: {
  id: string;
  walletAddress: string;
  hyperliquidChain: HyperliquidChain;
  signatureChainId: `0x${string}`;
  agentAddress: `0x${string}`;
  agentName: string;
  riskSettings: CopytradeRiskSettings;
  status: string;
  approvalNonce: number;
  approvalResponse?: unknown;
  lastError?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
}) => ({
  id: enrollment.id,
  walletAddress: enrollment.walletAddress,
  hyperliquidChain: enrollment.hyperliquidChain,
  signatureChainId: enrollment.signatureChainId,
  agentAddress: enrollment.agentAddress,
  agentName: enrollment.agentName,
  riskSettings: enrollment.riskSettings,
  status: enrollment.status,
  approvalNonce: enrollment.approvalNonce,
  approvalResponse: enrollment.approvalResponse,
  lastError: enrollment.lastError ?? null,
  approvedAt: enrollment.approvedAt ?? null,
  createdAt: enrollment.createdAt ?? null,
});

const resolveTradeLifecycleStatus = (trade: CopytradeTrade): PresentedTradeStatus => {
  if (trade.status === "failed" || trade.status === "skipped") {
    return trade.status;
  }

  if (trade.closedAt) {
    return "closed";
  }

  if (trade.openedAt || trade.status === "open") {
    return "open";
  }

  return trade.status;
};

const parseLivePositions = (state: HyperliquidClearinghouseState): LiveHyperliquidPosition[] =>
  (state.assetPositions ?? [])
    .map(({ position }) => {
      if (!position) {
        return null;
      }

      const signedQuantity = parseNumber(position.szi);

      if (signedQuantity === null || signedQuantity === 0) {
        return null;
      }

      return {
        asset: normalizeAsset(position.coin ?? ""),
        direction: signedQuantity > 0 ? "LONG" : "SHORT",
        entryPrice: parseNumber(position.entryPx),
        leverage: parseNumber(position.leverage?.value),
        pnlUsd: parseNumber(position.unrealizedPnl),
        positionValue: parseNumber(position.positionValue),
        quantity: Math.abs(signedQuantity),
      } satisfies LiveHyperliquidPosition;
    })
    .filter((position): position is LiveHyperliquidPosition => position !== null);

const findClosingFill = (trade: CopytradeTrade, fills: HyperliquidFill[]) => {
  const openedAt = trade.openedAt ? new Date(trade.openedAt).getTime() : null;
  const asset = normalizeAsset(trade.asset);
  const closingOrderIds = new Set(
    [trade.takeProfitOrderId, trade.stopLossOrderId].filter((value): value is string => Boolean(value)),
  );

  return fills.find((fill) => {
    const fillOrderId = typeof fill.oid === "number" ? fill.oid.toString() : "";
    const fillTime = typeof fill.time === "number" ? fill.time : null;
    const isAfterOpen = !openedAt || !fillTime || fillTime >= openedAt;
    const isSameAsset = normalizeAsset(fill.coin ?? "") === asset;
    const isClosingDirection = typeof fill.dir === "string" && fill.dir.toLowerCase().includes("close");
    const isKnownClosingOrder = closingOrderIds.size > 0 && closingOrderIds.has(fillOrderId);

    return isSameAsset && isAfterOpen && (isKnownClosingOrder || isClosingDirection);
  });
};

const reconcileDashboardTradesWithHyperliquid = async (
  repositories: CopytradeRepositories,
  input: {
    enrollment: { hyperliquidChain: HyperliquidChain };
    trades: CopytradeTrade[];
    walletAddress: `0x${string}`;
  },
) => {
  const activeTrades = input.trades.filter((trade) => {
    const status = resolveTradeLifecycleStatus(trade);
    return status === "open" || status === "queued";
  });

  if (activeTrades.length === 0) {
    return input.trades;
  }

  const [state, fills] = await Promise.all([
    fetchHyperliquidInfo<HyperliquidClearinghouseState>(input.enrollment.hyperliquidChain, {
      type: "clearinghouseState",
      user: input.walletAddress,
    }),
    fetchHyperliquidInfo<HyperliquidFill[]>(input.enrollment.hyperliquidChain, {
      type: "userFills",
      user: input.walletAddress,
      aggregateByTime: true,
    }),
  ]);
  const livePositions = parseLivePositions(state);
  const stateTimestamp = typeof state.time === "number" ? new Date(state.time).toISOString() : new Date().toISOString();
  const updatedTrades = new Map<string, CopytradeTrade>();

  for (const trade of activeTrades) {
    const position = livePositions.find((candidate) =>
      candidate.asset === normalizeAsset(trade.asset) &&
      candidate.direction === trade.direction
    );
    let patch: Partial<CreateCopytradeTradeInput> | null = null;

    if (position) {
      patch = {
        status: "open",
        entryPrice: position.entryPrice ?? trade.entryPrice,
        quantity: position.quantity,
        leverage: position.leverage ?? trade.leverage,
        notionalUsd: position.positionValue ?? trade.notionalUsd,
        pnlUsd: position.pnlUsd ?? trade.pnlUsd,
        pnlPercent: calculatePnlPercent(position.pnlUsd, position.positionValue ?? trade.notionalUsd),
        openedAt: trade.openedAt ?? stateTimestamp,
        lastError: null,
      };
    } else if (trade.status === "open" || trade.openedAt) {
      const closingFill = findClosingFill(trade, fills);
      const pnlUsd = parseNumber(closingFill?.closedPnl);
      const exitPrice = parseNumber(closingFill?.px);
      const closedAt = typeof closingFill?.time === "number"
        ? new Date(closingFill.time).toISOString()
        : stateTimestamp;

      patch = {
        status: "closed",
        exitPrice: exitPrice ?? trade.exitPrice,
        pnlUsd: pnlUsd ?? trade.pnlUsd,
        pnlPercent: calculatePnlPercent(pnlUsd ?? trade.pnlUsd, trade.notionalUsd),
        closedAt,
        lastError: null,
      };
    }

    if (!patch) {
      continue;
    }

    const updated = await repositories.trades.updateTrade(trade.id, patch);

    if (!updated.ok) {
      throw new Error(updated.error.message);
    }

    updatedTrades.set(trade.id, updated.value);
  }

  return input.trades.map((trade) => updatedTrades.get(trade.id) ?? trade);
};

const presentTrade = (trade: CopytradeTrade) => ({
  id: trade.id,
  enrollmentId: trade.enrollmentId,
  walletAddress: trade.walletAddress,
  signalId: trade.signalId,
  asset: trade.asset,
  direction: trade.direction,
  status: resolveTradeLifecycleStatus(trade),
  orderId: trade.orderId,
  takeProfitOrderId: trade.takeProfitOrderId,
  stopLossOrderId: trade.stopLossOrderId,
  entryPrice: trade.entryPrice,
  exitPrice: trade.exitPrice,
  quantity: trade.quantity,
  leverage: trade.leverage,
  notionalUsd: trade.notionalUsd,
  pnlUsd: trade.pnlUsd,
  pnlPercent: trade.pnlPercent,
  openedAt: trade.openedAt,
  closedAt: trade.closedAt,
  lastError: trade.lastError,
  createdAt: trade.createdAt,
  updatedAt: trade.updatedAt,
});

const buildTradeStats = (trades: CopytradeTrade[]) => {
  const closedTrades = trades.filter((trade) => resolveTradeLifecycleStatus(trade) === "closed");
  const openTrades = trades.filter((trade) => resolveTradeLifecycleStatus(trade) === "open");
  const failedTrades = trades.filter((trade) => resolveTradeLifecycleStatus(trade) === "failed");
  const realizedPnlUsd = closedTrades.reduce((total, trade) => total + (trade.pnlUsd ?? 0), 0);
  const pnlPercentValues = closedTrades
    .map((trade) => trade.pnlPercent)
    .filter((value): value is number => typeof value === "number");
  const averagePnlPercent =
    pnlPercentValues.length > 0
      ? pnlPercentValues.reduce((total, value) => total + value, 0) / pnlPercentValues.length
      : 0;
  const winningTrades = closedTrades.filter((trade) => (trade.pnlUsd ?? 0) > 0).length;
  const copiedNotionalUsd = trades.reduce((total, trade) => total + (trade.notionalUsd ?? 0), 0);

  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    failedTrades: failedTrades.length,
    winRate: closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0,
    realizedPnlUsd,
    averagePnlPercent,
    copiedNotionalUsd,
  };
};

const fetchHyperliquidAccount = async (
  walletAddress: `0x${string}`,
  hyperliquidChain: HyperliquidChain,
) => {
  const payload = await fetchHyperliquidInfo<HyperliquidClearinghouseState>(
    hyperliquidChain,
    {
      type: "clearinghouseState",
      user: walletAddress,
    },
  );

  const accountValue = Number(payload.marginSummary?.accountValue ?? 0);
  const withdrawable = Number(payload.withdrawable ?? 0);

  return {
    accountValue: Number.isFinite(accountValue) ? accountValue : 0,
    hyperliquidChain,
    meetsMinimum: Number.isFinite(accountValue) && accountValue >= MINIMUM_ACCOUNT_VALUE_USD,
    minimumAccountValue: MINIMUM_ACCOUNT_VALUE_USD,
    totalMarginUsed: Number(payload.marginSummary?.totalMarginUsed ?? 0),
    totalNtlPos: Number(payload.marginSummary?.totalNtlPos ?? 0),
    totalRawUsd: Number(payload.marginSummary?.totalRawUsd ?? 0),
    walletAddress,
    withdrawable: Number.isFinite(withdrawable) ? withdrawable : 0,
  };
};

export const createCopytradeStatusController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repositories = createRepositories(env);
    const walletAddress = typeof req.query.walletAddress === "string"
      ? req.query.walletAddress.toLowerCase()
      : "";
    const hyperliquidChain = parseHyperliquidChain(req.query.hyperliquidChain);

    if (!isAddress(walletAddress)) {
      res.status(400).json({ success: false, error: "A valid walletAddress is required." });
      return;
    }

    if (!repositories) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    const found = await repositories.enrollments.findLatestByWalletAndChain(walletAddress, hyperliquidChain);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    res.json({ success: true, data: found.value ? presentEnrollment(found.value) : null });
  };

export const createCopytradeAccountController =
  async (req: Request, res: Response) => {
    const walletAddress = typeof req.query.walletAddress === "string"
      ? req.query.walletAddress.toLowerCase()
      : "";
    const hyperliquidChain = parseHyperliquidChain(req.query.hyperliquidChain);

    if (!isAddress(walletAddress)) {
      res.status(400).json({ success: false, error: "A valid walletAddress is required." });
      return;
    }

    try {
      res.json({
        success: true,
        data: await fetchHyperliquidAccount(walletAddress, hyperliquidChain),
      });
    } catch (caught) {
      res.status(502).json({
        success: false,
        error: caught instanceof Error ? caught.message : "Hyperliquid account lookup failed.",
      });
    }
  };

export const createCopytradeDashboardController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repositories = createRepositories(env);
    const walletAddress = typeof req.query.walletAddress === "string"
      ? req.query.walletAddress.toLowerCase()
      : "";
    const hyperliquidChain = parseHyperliquidChain(req.query.hyperliquidChain);
    const page = parsePositiveInteger(req.query.page, 1);
    const pageSize = parsePositiveInteger(
      req.query.pageSize,
      DEFAULT_TRADE_PAGE_SIZE,
      MAX_TRADE_PAGE_SIZE,
    );
    const offset = (page - 1) * pageSize;

    if (!isAddress(walletAddress)) {
      res.status(400).json({ success: false, error: "A valid walletAddress is required." });
      return;
    }

    if (!repositories) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    const enrollmentResult = await repositories.enrollments.findLatestByWalletAndChain(
      walletAddress,
      hyperliquidChain,
    );

    if (!enrollmentResult.ok) {
      res.status(500).json({ success: false, error: enrollmentResult.error.message });
      return;
    }

    const enrollment = enrollmentResult.value;
    const [statsTradesResult, tradesResult, totalTradesResult] = enrollment
      ? await Promise.all([
          repositories.trades.listByEnrollment(enrollment.id, TRADE_STATS_HISTORY_LIMIT),
          repositories.trades.listByEnrollment(enrollment.id, pageSize, offset),
          repositories.trades.countByEnrollment(enrollment.id),
        ])
      : [
          { ok: true as const, value: [] },
          { ok: true as const, value: [] },
          { ok: true as const, value: 0 },
        ];

    if (!statsTradesResult.ok) {
      res.status(500).json({ success: false, error: statsTradesResult.error.message });
      return;
    }

    if (!tradesResult.ok) {
      res.status(500).json({ success: false, error: tradesResult.error.message });
      return;
    }

    if (!totalTradesResult.ok) {
      res.status(500).json({ success: false, error: totalTradesResult.error.message });
      return;
    }

    let statsTrades = statsTradesResult.value;
    let trades = tradesResult.value;

    if (enrollment) {
      try {
        const uniqueTrades = Array.from(
          new Map([...statsTrades, ...trades].map((trade) => [trade.id, trade])).values(),
        );
        const reconciled = await reconcileDashboardTradesWithHyperliquid(repositories, {
          enrollment,
          trades: uniqueTrades,
          walletAddress,
        });
        const reconciledById = new Map(reconciled.map((trade) => [trade.id, trade]));
        statsTrades = statsTrades.map((trade) => reconciledById.get(trade.id) ?? trade);
        trades = trades.map((trade) => reconciledById.get(trade.id) ?? trade);
      } catch (caught) {
        res.status(502).json({
          success: false,
          error: caught instanceof Error ? caught.message : "Hyperliquid trade reconciliation failed.",
        });
        return;
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalTradesResult.value / pageSize));

    res.json({
      success: true,
      data: {
        enrollment: enrollment ? presentEnrollment(enrollment) : null,
        stats: buildTradeStats(statsTrades),
        tradePagination: {
          page,
          pageSize,
          total: totalTradesResult.value,
          totalPages,
        },
        trades: trades.map((trade) => presentTrade(trade)),
      },
    });
  };

export const createCopytradePrepareController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repositories = createRepositories(env);

    if (!repositories) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    if (!env.deferred.futuresEncryptionKey) {
      res.status(503).json({
        success: false,
        error: "FUTURES_ENCRYPTION_KEY is required before Omen can store an agent wallet.",
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const walletAddress = typeof body.walletAddress === "string"
      ? body.walletAddress.toLowerCase()
      : "";
    const signatureChainId = body.signatureChainId;
    const hyperliquidChain = parseHyperliquidChain(body.hyperliquidChain);

    if (!isAddress(walletAddress) || !isHexChainId(signatureChainId)) {
      res.status(400).json({ success: false, error: "Wallet address and signature chain id are required." });
      return;
    }

    const agentWallet = Wallet.createRandom();
    const approvalNonce = Date.now();
    const riskSettings = parseRiskSettings(body.riskSettings);
    const encryptedAgentPrivateKey = encryptAgentKey(
      agentWallet.privateKey,
      env.deferred.futuresEncryptionKey,
    );

    const created = await repositories.enrollments.createEnrollment({
      walletAddress,
      hyperliquidChain,
      signatureChainId,
      agentAddress: agentWallet.address.toLowerCase() as `0x${string}`,
      agentName: AGENT_NAME,
      encryptedAgentPrivateKey,
      riskSettings,
      status: "pending_approval",
      approvalNonce,
    });

    if (!created.ok) {
      res.status(500).json({ success: false, error: created.error.message });
      return;
    }

    res.json({ success: true, data: presentEnrollment(created.value) });
  };

export const createCopytradeRiskSettingsController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repositories = createRepositories(env);

    if (!repositories) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const walletAddress = typeof body.walletAddress === "string"
      ? body.walletAddress.toLowerCase()
      : "";
    const hyperliquidChain = parseHyperliquidChain(body.hyperliquidChain);

    if (!isAddress(walletAddress)) {
      res.status(400).json({ success: false, error: "A valid walletAddress is required." });
      return;
    }

    const found = await repositories.enrollments.findLatestByWalletAndChain(walletAddress, hyperliquidChain);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    if (!found.value) {
      res.status(404).json({ success: false, error: "No copytrade enrollment exists for this wallet and network." });
      return;
    }

    const updated = await repositories.enrollments.updateEnrollment(found.value.id, {
      risk_settings: parseRiskSettings(body.riskSettings),
    });

    if (!updated.ok) {
      res.status(500).json({ success: false, error: updated.error.message });
      return;
    }

    res.json({ success: true, data: presentEnrollment(updated.value) });
  };

export const createCopytradeFinalizeController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repositories = createRepositories(env);

    if (!repositories) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const enrollmentId = typeof body.enrollmentId === "string" ? body.enrollmentId : "";
    const action = body.action;
    const signature = body.signature;

    if (!enrollmentId || !action || typeof action !== "object" || !signature || typeof signature !== "object") {
      res.status(400).json({ success: false, error: "Enrollment id, action, and signature are required." });
      return;
    }

    const hyperliquidChain = parseHyperliquidChain(
      (action as { hyperliquidChain?: unknown }).hyperliquidChain,
    );

    const exchangeResponse = await fetch(HYPERLIQUID_EXCHANGE_URLS[hyperliquidChain], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        signature,
        nonce: (action as { nonce?: unknown }).nonce,
      }),
    });
    const payload = await exchangeResponse.json().catch(() => null) as unknown;
    const isApproved =
      exchangeResponse.ok &&
      Boolean(payload) &&
      typeof payload === "object" &&
      (payload as { status?: unknown }).status === "ok";

    const updated = await repositories.enrollments.updateEnrollment(enrollmentId, {
      approval_response: payload,
      last_error: isApproved ? null : `Hyperliquid approval failed with status ${exchangeResponse.status.toString()}.`,
      status: isApproved ? "active" : "approval_failed",
      approved_at: isApproved ? new Date().toISOString() : null,
    });

    if (!updated.ok) {
      res.status(500).json({ success: false, error: updated.error.message });
      return;
    }

    if (!isApproved) {
      res.status(502).json({
        success: false,
        error: "Hyperliquid rejected the agent approval.",
        data: presentEnrollment(updated.value),
      });
      return;
    }

    res.json({ success: true, data: presentEnrollment(updated.value) });
  };
