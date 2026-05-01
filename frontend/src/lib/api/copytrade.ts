import { apiRequest, type Parser } from './client';

export type HyperliquidChain = 'Mainnet' | 'Testnet';

export type CopytradeRiskSettings = {
  maxAllocationUsd: number;
  riskPerSignalPercent: number;
  maxLeverage: number;
  maxOpenPositions: number;
  allowedAssets: string[];
  copyLongs: boolean;
  copyShorts: boolean;
};

export type CopytradeEnrollment = {
  id: string;
  walletAddress: `0x${string}`;
  hyperliquidChain: HyperliquidChain;
  signatureChainId: `0x${string}`;
  agentAddress: `0x${string}`;
  agentName: string;
  riskSettings: CopytradeRiskSettings;
  status: 'pending_approval' | 'active' | 'paused' | 'revoked' | 'approval_failed';
  approvalNonce: number;
  approvalResponse: unknown;
  lastError: string | null;
  approvedAt: string | null;
  createdAt: string | null;
};

export type CopytradeTrade = {
  id: string;
  enrollmentId: string;
  walletAddress: string;
  signalId: string | null;
  asset: string;
  direction: 'LONG' | 'SHORT';
  status: 'queued' | 'open' | 'closed' | 'failed' | 'skipped';
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
  createdAt: string;
  updatedAt: string;
};

export type CopytradeDashboard = {
  enrollment: CopytradeEnrollment | null;
  stats: {
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    failedTrades: number;
    winRate: number;
    realizedPnlUsd: number;
    averagePnlPercent: number;
    copiedNotionalUsd: number;
  };
  tradePagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  trades: CopytradeTrade[];
};

export type CopytradeAccount = {
  walletAddress: `0x${string}`;
  hyperliquidChain: HyperliquidChain;
  accountValue: number;
  withdrawable: number;
  totalMarginUsed: number;
  totalNtlPos: number;
  totalRawUsd: number;
  minimumAccountValue: number;
  meetsMinimum: boolean;
};

export type HyperliquidApproveAgentAction = {
  type: 'approveAgent';
  signatureChainId: `0x${string}`;
  hyperliquidChain: HyperliquidChain;
  agentAddress: `0x${string}`;
  agentName: string;
  nonce: number;
};

export type HyperliquidSignature = {
  r: `0x${string}`;
  s: `0x${string}`;
  v: 27 | 28;
};

const enrollmentParser: Parser<CopytradeEnrollment> = {
  parse(input) {
    return input as CopytradeEnrollment;
  },
};

const nullableEnrollmentParser: Parser<CopytradeEnrollment | null> = {
  parse(input) {
    return input as CopytradeEnrollment | null;
  },
};

const dashboardParser: Parser<CopytradeDashboard> = {
  parse(input) {
    return input as CopytradeDashboard;
  },
};

const accountParser: Parser<CopytradeAccount> = {
  parse(input) {
    return input as CopytradeAccount;
  },
};

export const getCopytradeAccount = (input: {
  walletAddress: string;
  hyperliquidChain: HyperliquidChain;
}) =>
  apiRequest<CopytradeAccount>(
    `/copytrade/account?walletAddress=${encodeURIComponent(input.walletAddress)}&hyperliquidChain=${encodeURIComponent(input.hyperliquidChain)}`,
    accountParser,
  );

export const getCopytradeStatus = (input: {
  walletAddress: string;
  hyperliquidChain: HyperliquidChain;
}) =>
  apiRequest<CopytradeEnrollment | null>(
    `/copytrade/status?walletAddress=${encodeURIComponent(input.walletAddress)}&hyperliquidChain=${encodeURIComponent(input.hyperliquidChain)}`,
    nullableEnrollmentParser,
  );

export const getCopytradeDashboard = (
  walletAddress: string,
  input: { hyperliquidChain: HyperliquidChain; page?: number; pageSize?: number },
) => {
  const params = new URLSearchParams({
    hyperliquidChain: input.hyperliquidChain,
    walletAddress,
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 20),
  });

  return apiRequest<CopytradeDashboard>(
    `/copytrade/dashboard?${params.toString()}`,
    dashboardParser,
  );
};

export const prepareCopytradeApproval = (input: {
  walletAddress: string;
  signatureChainId: `0x${string}`;
  hyperliquidChain: HyperliquidChain;
  riskSettings: CopytradeRiskSettings;
}) =>
  apiRequest<CopytradeEnrollment>('/copytrade/prepare', enrollmentParser, {
    method: 'POST',
    body: input,
  });

export const finalizeCopytradeApproval = (input: {
  enrollmentId: string;
  action: HyperliquidApproveAgentAction;
  signature: HyperliquidSignature;
}) =>
  apiRequest<CopytradeEnrollment>('/copytrade/finalize', enrollmentParser, {
    method: 'POST',
    body: input,
  });
