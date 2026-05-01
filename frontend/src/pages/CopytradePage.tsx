import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CopyCheck,
  KeyRound,
  Loader2,
  PauseCircle,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';

import {
  finalizeCopytradeApproval,
  getCopytradeStatus,
  prepareCopytradeApproval,
  type CopytradeEnrollment,
  type CopytradeRiskSettings,
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
  allowedAssets: ['BTC', 'ETH', 'SOL', 'HYPE'],
  copyLongs: true,
  copyShorts: true,
};

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

export function CopytradePage() {
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<`0x${string}` | null>(null);
  const [hyperliquidChain, setHyperliquidChain] = useState<HyperliquidChain>('Mainnet');
  const [riskSettings, setRiskSettings] = useState<CopytradeRiskSettings>(DEFAULT_RISK_SETTINGS);
  const [assetInput, setAssetInput] = useState(DEFAULT_RISK_SETTINGS.allowedAssets.join(', '));
  const [enrollment, setEnrollment] = useState<CopytradeEnrollment | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = enrollment?.status === 'active';
  const canApprove = Boolean(walletAddress && chainId && !isApproving);

  const selectedAssets = useMemo(
    () =>
      assetInput
        .split(',')
        .map((asset) => asset.trim().toUpperCase())
        .filter(Boolean),
    [assetInput],
  );

  useEffect(() => {
    setRiskSettings((current) => ({ ...current, allowedAssets: selectedAssets }));
  }, [selectedAssets]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    setIsLoadingStatus(true);
    getCopytradeStatus(walletAddress)
      .then(setEnrollment)
      .catch(() => setEnrollment(null))
      .finally(() => setIsLoadingStatus(false));
  }, [walletAddress]);

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

  const approveCopytrade = async () => {
    if (!walletAddress || !chainId || !window.ethereum) {
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Hyperliquid approval failed.');
    } finally {
      setIsApproving(false);
    }
  };

  const updateRisk = (patch: Partial<CopytradeRiskSettings>) => {
    setRiskSettings((current) => ({ ...current, ...patch }));
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
        <button
          type="button"
          onClick={connectWallet}
          disabled={isConnecting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          {walletAddress ? formatAddress(walletAddress) : 'Connect wallet'}
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : null}

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

          <label className="mt-4 block space-y-2">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-gray-500">Allowed assets</span>
            <input
              type="text"
              value={assetInput}
              onChange={(event) => setAssetInput(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-800 bg-black/50 px-3 font-mono text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </label>

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
    </div>
  );
}
