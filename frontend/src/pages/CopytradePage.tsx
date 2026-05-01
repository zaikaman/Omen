import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CopyCheck,
  DollarSign,
  History,
  KeyRound,
  LogOut,
  Loader2,
  PauseCircle,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import {
  finalizeCopytradeApproval,
  getCopytradeAccount,
  getCopytradeDashboard,
  getCopytradeStatus,
  prepareCopytradeApproval,
  updateCopytradeRiskSettings,
  type CopytradeAccount,
  type CopytradeDashboard,
  type CopytradeEnrollment,
  type CopytradeRiskSettings,
  type CopytradeTrade,
  type HyperliquidApproveAgentAction,
  type HyperliquidChain,
  type HyperliquidSignature,
} from '../lib/api/copytrade';

type EthereumProvider = {
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const APPROVE_AGENT_TYPES = {
  'HyperliquidTransaction:ApproveAgent': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'agentAddress', type: 'address' },
    { name: 'agentName', type: 'string' },
    { name: 'nonce', type: 'uint64' },
  ],
};

const DEFAULT_RISK_SETTINGS: CopytradeRiskSettings = {
  maxAllocationUsd: 250,
  riskPerSignalPercent: 1,
  maxLeverage: 5,
  maxOpenPositions: 3,
  allowedAssets: [],
  copyLongs: true,
  copyShorts: true,
};
const TRADE_HISTORY_PAGE_SIZE = 20;

const buildApprovalAction = (enrollment: CopytradeEnrollment): HyperliquidApproveAgentAction => ({
  type: 'approveAgent',
  signatureChainId: enrollment.signatureChainId,
  hyperliquidChain: enrollment.hyperliquidChain,
  agentAddress: enrollment.agentAddress,
  agentName: enrollment.agentName,
  nonce: enrollment.approvalNonce,
});

const buildTypedData = (action: HyperliquidApproveAgentAction) => ({
  domain: {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: Number.parseInt(action.signatureChainId, 16),
    verifyingContract: ZERO_ADDRESS,
  },
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    ...APPROVE_AGENT_TYPES,
  },
  primaryType: 'HyperliquidTransaction:ApproveAgent',
  message: {
    hyperliquidChain: action.hyperliquidChain,
    agentAddress: action.agentAddress,
    agentName: action.agentName,
    nonce: action.nonce,
  },
});

const toHyperliquidSignature = (signature: `0x${string}`): HyperliquidSignature => {
  const normalizedSignature = signature.toLowerCase();
  const r = `0x${normalizedSignature.slice(2, 66)}` as `0x${string}`;
  const s = `0x${normalizedSignature.slice(66, 130)}` as `0x${string}`;
  const recoveryByte = Number.parseInt(normalizedSignature.slice(130, 132), 16);
  const v = recoveryByte === 28 || recoveryByte === 1 ? 28 : 27;

  return {
    r,
    s,
    v,
  };
};

const formatAddress = (address: string | null) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';

const statusLabel = (status: CopytradeEnrollment['status'] | null) => {
  if (!status) {
    return 'Not enrolled';
  }

  return status.replace(/_/g, ' ').toUpperCase();
};

const formatCurrency = (value: number | null | undefined) => {
  const amount = value ?? 0;

  return new Intl.NumberFormat(undefined, {
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(amount);
};

const formatPercent = (value: number | null | undefined) =>
  `${(value ?? 0).toFixed(2)}%`;

const formatDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Not recorded';

const tradeStatusClass = (status: CopytradeTrade['status']) => {
  switch (status) {
    case 'closed':
      return 'border-green-500/20 bg-green-500/10 text-green-300';
    case 'open':
      return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
    case 'failed':
      return 'border-red-500/20 bg-red-500/10 text-red-300';
    case 'skipped':
      return 'border-gray-700 bg-gray-900 text-gray-400';
    case 'queued':
    default:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  }
};

const resolveTradeStatus = (trade: CopytradeTrade): CopytradeTrade['status'] => {
  if (trade.status === 'failed' || trade.status === 'skipped') {
    return trade.status;
  }

  if (trade.closedAt) {
    return 'closed';
  }

  if (trade.openedAt || trade.status === 'open') {
    return 'open';
  }

  return trade.status;
};

const tradeLifecycleLabel = (trade: CopytradeTrade) => {
  const status = resolveTradeStatus(trade);

  if (status === 'closed') {
    return trade.closedAt ? `Closed ${formatDate(trade.closedAt)}` : 'Closed';
  }

  if (status === 'open') {
    return 'Position open';
  }

  return status.replace(/_/g, ' ');
};

function RiskInput({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-gray-500">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-black/50 px-3 py-2 focus-within:border-cyan-500/50">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none"
        />
        {suffix ? <span className="text-xs font-mono text-gray-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'cyan';
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-green-300'
      : tone === 'negative'
        ? 'text-red-300'
        : tone === 'cyan'
          ? 'text-cyan-300'
          : 'text-white';

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">{label}</div>
        <div className="text-cyan-400">{icon}</div>
      </div>
      <div className={`mt-3 font-mono text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

function CopytradeDashboardView({
  account,
  dashboard,
  enrollment,
  isLoading,
  isLoadingAccount,
  isSavingRisk,
  onRiskChange,
  onSaveRisk,
  onTradePageChange,
  riskSettings,
  tradePage,
}: {
  account: CopytradeAccount | null;
  dashboard: CopytradeDashboard | null;
  enrollment: CopytradeEnrollment;
  isLoading: boolean;
  isLoadingAccount: boolean;
  isSavingRisk: boolean;
  onRiskChange: (patch: Partial<CopytradeRiskSettings>) => void;
  onSaveRisk: () => void;
  onTradePageChange: (page: number) => void;
  riskSettings: CopytradeRiskSettings;
  tradePage: number;
}) {
  const stats = dashboard?.stats;
  const trades = dashboard?.trades ?? [];
  const pagination = dashboard?.tradePagination ?? {
    page: tradePage,
    pageSize: TRADE_HISTORY_PAGE_SIZE,
    total: trades.length,
    totalPages: Math.max(1, Math.ceil(trades.length / TRADE_HISTORY_PAGE_SIZE)),
  };
  const startTrade = pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endTrade = Math.min(pagination.total, pagination.page * pagination.pageSize);
  const pnlTone = (stats?.realizedPnlUsd ?? 0) > 0
    ? 'positive'
    : (stats?.realizedPnlUsd ?? 0) < 0
      ? 'negative'
      : 'neutral';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={isLoadingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          label="Current equity"
          value={account ? formatCurrency(account.accountValue) : 'Unavailable'}
          tone="cyan"
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Realized PnL"
          value={formatCurrency(stats?.realizedPnlUsd)}
          tone={pnlTone}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Win rate"
          value={formatPercent(stats?.winRate)}
          tone="cyan"
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Open trades"
          value={(stats?.openTrades ?? 0).toString()}
        />
        <StatCard
          icon={<History className="h-4 w-4" />}
          label="Total copied"
          value={(stats?.totalTrades ?? 0).toString()}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Execution layer</div>
              <h3 className="mt-1 text-lg font-bold text-white">Hyperliquid copy is active</h3>
            </div>
            <span className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-green-300">
              Active
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Omen API wallet</div>
              <div className="mt-1 font-mono text-sm text-white">{formatAddress(enrollment.agentAddress)}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Network</div>
                <div className="mt-1 text-sm font-semibold text-white">{enrollment.hyperliquidChain}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Withdrawable</div>
                <div className="mt-1 font-mono text-sm text-white">
                  {account ? formatCurrency(account.withdrawable) : 'Unavailable'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Margin used</div>
                <div className="mt-1 font-mono text-sm text-white">
                  {account ? formatCurrency(account.totalMarginUsed) : 'Unavailable'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Approved at</div>
                <div className="mt-1 text-sm text-white">{formatDate(enrollment.approvedAt)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Risk limits</h3>
            </div>
            <button
              type="button"
              onClick={onSaveRisk}
              disabled={isSavingRisk}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500 px-3 text-xs font-bold text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingRisk ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
              Save limits
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <RiskInput
              label="Max allocation"
              value={riskSettings.maxAllocationUsd}
              min={0}
              max={1_000_000}
              suffix="USDC"
              onChange={(value) => onRiskChange({ maxAllocationUsd: value })}
            />
            <RiskInput
              label="Risk per signal"
              value={riskSettings.riskPerSignalPercent}
              min={0.1}
              max={10}
              step={0.1}
              suffix="%"
              onChange={(value) => onRiskChange({ riskPerSignalPercent: value })}
            />
            <RiskInput
              label="Max leverage"
              value={riskSettings.maxLeverage}
              min={1}
              max={50}
              suffix="x"
              onChange={(value) => onRiskChange({ maxLeverage: value })}
            />
            <RiskInput
              label="Max positions"
              value={riskSettings.maxOpenPositions}
              min={1}
              max={10}
              onChange={(value) => onRiskChange({ maxOpenPositions: value })}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-300">
              Copy longs
              <input
                type="checkbox"
                checked={riskSettings.copyLongs}
                onChange={(event) => onRiskChange({ copyLongs: event.target.checked })}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-300">
              Copy shorts
              <input
                type="checkbox"
                checked={riskSettings.copyShorts}
                onChange={(event) => onRiskChange({ copyShorts: event.target.checked })}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-300" />
            <h3 className="text-lg font-bold text-white">Trade history</h3>
          </div>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> : null}
        </div>

        {trades.length > 0 ? (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-gray-800 text-[10px] font-mono uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Asset</th>
                    <th className="px-3 py-3">Side</th>
                    <th className="px-3 py-3">Lifecycle</th>
                    <th className="px-3 py-3 text-right">Notional</th>
                    <th className="px-3 py-3 text-right">Entry</th>
                    <th className="px-3 py-3 text-right">Exit</th>
                    <th className="px-3 py-3 text-right">PnL</th>
                    <th className="px-3 py-3">Opened</th>
                    <th className="px-3 py-3">Closed</th>
                    <th className="px-3 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/80">
                  {trades.map((trade) => {
                    const status = resolveTradeStatus(trade);

                    return (
                      <tr key={trade.id} className="text-gray-300">
                        <td className="px-3 py-3 font-mono font-bold text-white">{trade.asset}</td>
                        <td className="px-3 py-3">{trade.direction}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${tradeStatusClass(status)}`}>
                              {status}
                            </span>
                            <span className="text-[10px] text-gray-500">{tradeLifecycleLabel(trade)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">{formatCurrency(trade.notionalUsd)}</td>
                        <td className="px-3 py-3 text-right font-mono">{trade.entryPrice?.toString() ?? '-'}</td>
                        <td className="px-3 py-3 text-right font-mono">{trade.exitPrice?.toString() ?? '-'}</td>
                        <td className={`px-3 py-3 text-right font-mono ${(trade.pnlUsd ?? 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                          {formatCurrency(trade.pnlUsd)}
                        </td>
                        <td className="px-3 py-3 text-gray-400">{formatDate(trade.openedAt ?? trade.createdAt)}</td>
                        <td className="px-3 py-3 text-gray-400">{trade.closedAt ? formatDate(trade.closedAt) : 'Still open'}</td>
                        <td className="max-w-[220px] truncate px-3 py-3 text-gray-500" title={trade.lastError ?? trade.orderId ?? undefined}>
                          {trade.lastError ?? (trade.orderId ? `Entry ${trade.orderId}` : '-')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-mono text-gray-500">
                Showing {startTrade}-{endTrade} of {pagination.total} trades
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTradePageChange(Math.max(1, pagination.page - 1))}
                  disabled={pagination.page <= 1 || isLoading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 bg-black text-gray-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous trade history page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[76px] text-center text-xs font-mono text-gray-400">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => onTradePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 bg-black text-gray-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next trade history page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-gray-800 bg-black/30 p-8 text-center">
            <History className="mx-auto h-8 w-8 text-gray-600" />
            <p className="mt-3 text-sm font-semibold text-white">No copied trades yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
              The dashboard will populate from real execution records once Omen starts placing Hyperliquid orders for this wallet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function CopytradePage() {
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<`0x${string}` | null>(null);
  const [hyperliquidChain, setHyperliquidChain] = useState<HyperliquidChain>('Mainnet');
  const [riskSettings, setRiskSettings] = useState<CopytradeRiskSettings>(DEFAULT_RISK_SETTINGS);
  const [account, setAccount] = useState<CopytradeAccount | null>(null);
  const [enrollment, setEnrollment] = useState<CopytradeEnrollment | null>(null);
  const [dashboard, setDashboard] = useState<CopytradeDashboard | null>(null);
  const [tradePage, setTradePage] = useState(1);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingRisk, setIsSavingRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const riskSettingsDirtyRef = useRef(false);

  const isActive = enrollment?.status === 'active' && enrollment.hyperliquidChain === hyperliquidChain;
  const canApprove = Boolean(
    walletAddress &&
      chainId &&
      !isApproving &&
      !isLoadingAccount &&
      account?.meetsMinimum,
  );
  const depositAmount = Math.max(
    0,
    (account?.minimumAccountValue ?? 100) - (account?.accountValue ?? 0),
  );
  const depositUrl =
    hyperliquidChain === 'Testnet'
      ? 'https://app.hyperliquid-testnet.xyz/'
      : 'https://app.hyperliquid.xyz/';

  useEffect(() => {
    if (!walletAddress) {
      setEnrollment(null);
      setDashboard(null);
      setTradePage(1);
      return;
    }

    let ignore = false;
    setEnrollment(null);
    setDashboard(null);
    setTradePage(1);
    setIsLoadingStatus(true);
    getCopytradeStatus({ walletAddress, hyperliquidChain })
      .then((latestEnrollment) => {
        if (ignore) {
          return;
        }
        setEnrollment(latestEnrollment);
        if (latestEnrollment && !riskSettingsDirtyRef.current) {
          setRiskSettings(latestEnrollment.riskSettings);
        }
        if (latestEnrollment?.status !== 'active') {
          setDashboard(null);
          setTradePage(1);
        }
      })
      .catch(() => {
        if (ignore) {
          return;
        }
        setEnrollment(null);
        setDashboard(null);
        setTradePage(1);
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingStatus(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [hyperliquidChain, walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setAccount(null);
      return;
    }

    let ignore = false;
    setAccount(null);
    setIsLoadingAccount(true);
    getCopytradeAccount({ walletAddress, hyperliquidChain })
      .then((nextAccount) => {
        if (!ignore) {
          setAccount(nextAccount);
        }
      })
      .catch(() => {
        if (!ignore) {
          setAccount(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingAccount(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [hyperliquidChain, walletAddress]);

  useEffect(() => {
    if (!walletAddress || !isActive) {
      setDashboard(null);
      setTradePage(1);
      return;
    }

    let ignore = false;
    setIsLoadingDashboard(true);
    getCopytradeDashboard(walletAddress, {
      hyperliquidChain,
      page: tradePage,
      pageSize: TRADE_HISTORY_PAGE_SIZE,
    })
      .then((nextDashboard) => {
        if (ignore) {
          return;
        }
        setDashboard(nextDashboard);
        if (nextDashboard.enrollment) {
          setEnrollment(nextDashboard.enrollment);
          if (!riskSettingsDirtyRef.current) {
            setRiskSettings(nextDashboard.enrollment.riskSettings);
          }
        }
      })
      .catch(() => {
        if (!ignore) {
          setDashboard(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingDashboard(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [hyperliquidChain, isActive, tradePage, walletAddress]);

  const connectWallet = async () => {
    setError(null);

    if (!window.ethereum) {
      setError('No EVM wallet was detected in this browser.');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request<string[]>({
        method: 'eth_requestAccounts',
      });
      const activeChainId = await window.ethereum.request<`0x${string}`>({
        method: 'eth_chainId',
      });
      setWalletAddress(accounts[0]?.toLowerCase() as `0x${string}`);
      setChainId(activeChainId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Wallet connection failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    setError(null);
    setWalletAddress(null);
    setChainId(null);
    setAccount(null);
    setEnrollment(null);
    setDashboard(null);
    setTradePage(1);
    riskSettingsDirtyRef.current = false;
    setRiskSettings(DEFAULT_RISK_SETTINGS);

    try {
      await window.ethereum?.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some injected wallets do not support permission revocation. Clearing local state is enough for Omen.
    }
  };

  const approveCopytrade = async () => {
    if (!walletAddress || !chainId || !window.ethereum) {
      return;
    }

    if (!account?.meetsMinimum) {
      setError(`Deposit at least ${formatCurrency(depositAmount)} more to Hyperliquid before enabling copytrading.`);
      return;
    }

    setError(null);
    setIsApproving(true);
    try {
      const prepared = await prepareCopytradeApproval({
        walletAddress,
        signatureChainId: chainId,
        hyperliquidChain,
        riskSettings,
      });
      const action = buildApprovalAction(prepared);
      const signature = await window.ethereum.request<`0x${string}`>({
        method: 'eth_signTypedData_v4',
        params: [walletAddress, JSON.stringify(buildTypedData(action))],
      });
      const finalized = await finalizeCopytradeApproval({
        enrollmentId: prepared.id,
        action,
        signature: toHyperliquidSignature(signature),
      });

      setEnrollment(finalized);
      setRiskSettings(finalized.riskSettings);
      riskSettingsDirtyRef.current = false;
      if (finalized.status === 'active') {
        setTradePage(1);
        setDashboard(await getCopytradeDashboard(walletAddress, {
          hyperliquidChain: finalized.hyperliquidChain,
          page: 1,
          pageSize: TRADE_HISTORY_PAGE_SIZE,
        }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Hyperliquid approval failed.');
    } finally {
      setIsApproving(false);
    }
  };

  const updateRisk = (patch: Partial<CopytradeRiskSettings>) => {
    riskSettingsDirtyRef.current = true;
    setRiskSettings((current) => ({ ...current, ...patch }));
  };

  const saveRiskSettings = async () => {
    if (!walletAddress) {
      setError('Connect a wallet before saving risk limits.');
      return;
    }

    setError(null);
    setIsSavingRisk(true);
    try {
      const updated = await updateCopytradeRiskSettings({
        walletAddress,
        hyperliquidChain,
        riskSettings,
      });
      setEnrollment(updated);
      setRiskSettings(updated.riskSettings);
      riskSettingsDirtyRef.current = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Risk limit update failed.');
    } finally {
      setIsSavingRisk(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <CopyCheck className="h-6 w-6 text-cyan-500" />
            Copytrade
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">
            Connect an EVM wallet, approve Omen as a Hyperliquid API wallet, then copy approved Omen signals with account-level limits.
          </p>
        </div>
        {walletAddress ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-4 text-sm font-mono text-gray-200">
              <Wallet className="h-4 w-4 text-cyan-400" />
              {formatAddress(walletAddress)}
            </div>
            <button
              type="button"
              onClick={disconnectWallet}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-800 bg-black px-4 text-sm font-semibold text-gray-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={connectWallet}
            disabled={isConnecting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Connect wallet
          </button>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : null}

      {isActive && enrollment ? (
        <CopytradeDashboardView
          account={account}
          dashboard={dashboard}
          enrollment={enrollment}
          isLoading={isLoadingDashboard}
          isLoadingAccount={isLoadingAccount}
          isSavingRisk={isSavingRisk}
          onRiskChange={updateRisk}
          onSaveRisk={saveRiskSettings}
          onTradePageChange={setTradePage}
          riskSettings={riskSettings}
          tradePage={tradePage}
        />
      ) : (
        <>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                Hyperliquid delegation
              </div>
              <h3 className="mt-1 text-lg font-bold text-white">Non-custodial execution layer</h3>
            </div>
            <div className="rounded-md border border-gray-800 bg-black px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400">
              {statusLabel(enrollment?.status ?? null)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
              <Wallet className="h-5 w-5 text-cyan-400" />
              <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">Master wallet</div>
              <div className="mt-1 font-mono text-sm text-white">{formatAddress(walletAddress)}</div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
              <KeyRound className="h-5 w-5 text-purple-300" />
              <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">Omen API wallet</div>
              <div className="mt-1 font-mono text-sm text-white">{formatAddress(enrollment?.agentAddress ?? null)}</div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
              <ShieldCheck className="h-5 w-5 text-green-400" />
              <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">Permission scope</div>
              <div className="mt-1 text-sm text-white">Trading only, no withdrawals</div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-gray-800 bg-black/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Network</div>
                <div className="mt-1 text-xs text-gray-500">Approval is signed on your current EVM chain and submitted to Hyperliquid.</div>
              </div>
              <div className="inline-flex rounded-lg border border-gray-800 bg-gray-950 p-1">
                {(['Mainnet', 'Testnet'] as const).map((network) => (
                  <button
                    key={network}
                    type="button"
                    onClick={() => setHyperliquidChain(network)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      hyperliquidChain === network
                        ? 'bg-cyan-500 text-black'
                        : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    {network}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {walletAddress ? (
            <div
              className={`mt-5 rounded-lg border p-4 ${
                account?.meetsMinimum
                  ? 'border-green-500/20 bg-green-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                    Hyperliquid account value
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {isLoadingAccount ? (
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                    ) : account?.meetsMinimum ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                    <span className="font-mono text-lg font-bold text-white">
                      {account ? formatCurrency(account.accountValue) : 'Unavailable'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Copytrading requires at least {formatCurrency(account?.minimumAccountValue ?? 100)} in Hyperliquid account value.
                  </p>
                </div>
                {!account?.meetsMinimum && !isLoadingAccount ? (
                  <a
                    href={depositUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/20"
                  >
                    Deposit {formatCurrency(depositAmount)}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={approveCopytrade}
            disabled={!canApprove || isActive}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-bold text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : isActive ? <CheckCircle2 className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {isActive ? 'Hyperliquid agent approved' : 'Sign once to enable copytrading'}
          </button>
        </section>

        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Risk settings</h3>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <RiskInput
              label="Max allocation"
              value={riskSettings.maxAllocationUsd}
              min={0}
              max={1_000_000}
              suffix="USDC"
              onChange={(value) => updateRisk({ maxAllocationUsd: value })}
            />
            <RiskInput
              label="Risk per signal"
              value={riskSettings.riskPerSignalPercent}
              min={0.1}
              max={10}
              step={0.1}
              suffix="%"
              onChange={(value) => updateRisk({ riskPerSignalPercent: value })}
            />
            <RiskInput
              label="Max leverage"
              value={riskSettings.maxLeverage}
              min={1}
              max={50}
              suffix="x"
              onChange={(value) => updateRisk({ maxLeverage: value })}
            />
            <RiskInput
              label="Max positions"
              value={riskSettings.maxOpenPositions}
              min={1}
              max={10}
              onChange={(value) => updateRisk({ maxOpenPositions: value })}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-300">
              Copy longs
              <input
                type="checkbox"
                checked={riskSettings.copyLongs}
                onChange={(event) => updateRisk({ copyLongs: event.target.checked })}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-300">
              Copy shorts
              <input
                type="checkbox"
                checked={riskSettings.copyShorts}
                onChange={(event) => updateRisk({ copyShorts: event.target.checked })}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-300" />
            <h3 className="text-lg font-bold text-white">Execution status</h3>
          </div>
          {isLoadingStatus ? <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Signal source</div>
            <div className="mt-1 text-sm text-white">Approved Omen signals</div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Automation</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-white">
              {isActive ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <PauseCircle className="h-4 w-4 text-amber-400" />}
              {isActive ? 'Ready for executor' : 'Waiting for approval'}
            </div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-black/40 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Approved at</div>
            <div className="mt-1 font-mono text-sm text-white">
              {enrollment?.approvedAt ? new Date(enrollment.approvedAt).toLocaleString() : 'Not approved'}
            </div>
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
