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

export const getCopytradeStatus = (walletAddress: string) =>
  apiRequest<CopytradeEnrollment | null>(
    `/copytrade/status?walletAddress=${encodeURIComponent(walletAddress)}`,
    nullableEnrollmentParser,
  );

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
