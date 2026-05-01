import type { Request, Response } from "express";
import { Wallet } from "ethers";

import {
  CopytradeEnrollmentsRepository,
  CopytradeTradesRepository,
  createSupabaseServiceRoleClient,
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
  const response = await fetch(HYPERLIQUID_INFO_URLS[hyperliquidChain], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "clearinghouseState",
      user: walletAddress,
    }),
  });
  const payload = await response.json().catch(() => null) as {
    marginSummary?: {
      accountValue?: string;
      totalMarginUsed?: string;
      totalNtlPos?: string;
      totalRawUsd?: string;
    };
    withdrawable?: string;
  } | null;

  if (!response.ok || !payload) {
    throw new Error(`Hyperliquid account lookup failed with status ${response.status.toString()}.`);
  }

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

    if (!isAddress(walletAddress)) {
      res.status(400).json({ success: false, error: "A valid walletAddress is required." });
      return;
    }

    if (!repositories) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    const found = await repositories.enrollments.findLatestByWallet(walletAddress);

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
    const hyperliquidChain = req.query.hyperliquidChain === "Testnet" ? "Testnet" : "Mainnet";

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

    const [enrollmentResult, statsTradesResult, tradesResult, totalTradesResult] = await Promise.all([
      repositories.enrollments.findLatestByWallet(walletAddress),
      repositories.trades.listByWallet(walletAddress, TRADE_STATS_HISTORY_LIMIT),
      repositories.trades.listByWallet(walletAddress, pageSize, offset),
      repositories.trades.countByWallet(walletAddress),
    ]);

    if (!enrollmentResult.ok) {
      res.status(500).json({ success: false, error: enrollmentResult.error.message });
      return;
    }

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

    const totalPages = Math.max(1, Math.ceil(totalTradesResult.value / pageSize));

    res.json({
      success: true,
      data: {
        enrollment: enrollmentResult.value ? presentEnrollment(enrollmentResult.value) : null,
        stats: buildTradeStats(statsTradesResult.value),
        tradePagination: {
          page,
          pageSize,
          total: totalTradesResult.value,
          totalPages,
        },
        trades: tradesResult.value.map((trade) => presentTrade(trade)),
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
    const hyperliquidChain = body.hyperliquidChain === "Testnet" ? "Testnet" : "Mainnet";

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

    const hyperliquidChain =
      (action as { hyperliquidChain?: unknown }).hyperliquidChain === "Testnet"
        ? "Testnet"
        : "Mainnet";

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
