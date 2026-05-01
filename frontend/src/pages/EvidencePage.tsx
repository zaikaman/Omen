import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProofArtifact, ProofFinalization } from '@omen/shared';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Certificate01Icon,
  Database01Icon,
  Link01Icon,
} from '@hugeicons/core-free-icons';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileJson,
  GitBranch,
  History,
  Network,
  RadioTower,
  ServerCrash,
  Zap,
} from 'lucide-react';

import { AxlTraceView } from '../components/network/AxlTraceView';
import { PeerTopologyPanel } from '../components/network/PeerTopologyPanel';
import { RouteTimeline } from '../components/network/RouteTimeline';
import { ServiceRegistryPanel } from '../components/network/ServiceRegistryPanel';
import { ArtifactList } from '../components/proofs/ArtifactList';
import { ChainAnchorCard } from '../components/proofs/ChainAnchorCard';
import { ComputeProofCard } from '../components/proofs/ComputeProofCard';
import { InftProofCard } from '../components/proofs/InftProofCard';
import { RunManifestPanel } from '../components/proofs/RunManifestPanel';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useInftProof } from '../hooks/useInft';
import { useProofDetail, useProofFeed } from '../hooks/useProofs';
import { useTopology } from '../hooks/useTopology';
import { cn } from '../lib/utils';

const REFRESH_INTERVAL_MS = 30_000;
const RUNS_PER_PAGE = 10;
const PROOF_FEED_LIMIT = 50;

const consoleSectionIds = [
  'storage',
  'compute',
  'chain',
  'axl-trace',
  'axl-peers',
  'axl-services',
  'axl-routes',
] as const;

type ConsoleSectionId =
  (typeof consoleSectionIds)[number];

const isConsoleSectionId = (value: string | null): value is ConsoleSectionId =>
  consoleSectionIds.includes(value as ConsoleSectionId);

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 24 ? `${value.slice(0, 14)}...${value.slice(-6)}` : value;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'UNKNOWN';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getArtifact = (artifacts: ProofArtifact[], refTypes: ProofArtifact['refType'][]) =>
  artifacts.find((artifact) => refTypes.includes(artifact.refType)) ?? null;

const countArtifacts = (artifacts: ProofArtifact[], refTypes: ProofArtifact['refType'][]) =>
  artifacts.filter((artifact) => refTypes.includes(artifact.refType)).length;

const filterArtifacts = (artifacts: ProofArtifact[], refTypes: ProofArtifact['refType'][]) =>
  artifacts.filter((artifact) => refTypes.includes(artifact.refType));

const metadataLink = (artifact: ProofArtifact | null, key: string) => {
  const value = artifact?.metadata[key];

  return typeof value === 'string' && value.startsWith('http') ? value : null;
};

const chainExplorerLink = (artifact: ProofArtifact | null) => {
  const directLink = metadataLink(artifact, 'explorerUrl');

  if (directLink) {
    return directLink;
  }

  const chainProof = artifact?.metadata.chainProof;

  if (chainProof && typeof chainProof === 'object' && 'explorerUrl' in chainProof) {
    const explorerUrl = chainProof.explorerUrl;

    return typeof explorerUrl === 'string' && explorerUrl.startsWith('http') ? explorerUrl : null;
  }

  return null;
};

const proofStatusLabel: Record<ProofFinalization['status'], string> = {
  not_configured: 'not configured',
  publishing: 'finalizing',
  anchoring: 'anchoring',
  complete: 'complete',
  partial: 'partial',
  failed: 'failed',
};

const proofStatusBadgeClass: Record<ProofFinalization['status'], string> = {
  not_configured: 'border-gray-500/40 bg-gray-500/10 text-gray-300',
  publishing: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
  anchoring: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  complete: 'border-green-500/40 bg-green-500/10 text-green-300',
  partial: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
  failed: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const isProofFinalizingStatus = (status: ProofFinalization['status']) =>
  status === 'publishing' || status === 'anchoring';

export function EvidencePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryRunId = searchParams.get('runId');
  const querySection = searchParams.get('section');
  const proofFeed = useProofFeed({
    limit: PROOF_FEED_LIMIT,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const topology = useTopology({
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const inftProof = useInftProof({
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runPage, setRunPage] = useState(1);
  const [activeSection, setActiveSection] = useState<ConsoleSectionId>('storage');
  const activeRunId = selectedRunId ?? queryRunId ?? proofFeed.proofs[0]?.runId ?? null;
  const proofDetail = useProofDetail(activeRunId, {
    enabled: Boolean(activeRunId),
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });

  useEffect(() => {
    if (queryRunId) {
      setSelectedRunId(queryRunId);
    }
  }, [queryRunId]);

  useEffect(() => {
    if (isConsoleSectionId(querySection)) {
      setActiveSection(querySection);
    }
  }, [querySection]);

  const runPageCount = Math.max(1, Math.ceil(proofFeed.proofs.length / RUNS_PER_PAGE));
  const paginatedProofs = useMemo(
    () => proofFeed.proofs.slice((runPage - 1) * RUNS_PER_PAGE, runPage * RUNS_PER_PAGE),
    [proofFeed.proofs, runPage],
  );

  useEffect(() => {
    setRunPage((currentPage) => Math.min(currentPage, runPageCount));
  }, [runPageCount]);

  const chainArtifact = useMemo(
    () => getArtifact(proofDetail.artifacts, ['chain_proof']),
    [proofDetail.artifacts],
  );
  const computeArtifact = useMemo(
    () => getArtifact(proofDetail.artifacts, ['compute_result', 'compute_job']),
    [proofDetail.artifacts],
  );
  const postArtifact = useMemo(
    () => getArtifact(proofDetail.artifacts, ['post_result', 'post_payload']),
    [proofDetail.artifacts],
  );
  const manifestArtifact =
    proofDetail.manifest?.manifestArtifact?.artifact ?? getArtifact(proofDetail.artifacts, ['manifest']);
  const publishedUrl = metadataLink(postArtifact, 'publishedUrl');
  const explorerUrl = chainExplorerLink(chainArtifact);
  const storageCount = countArtifacts(proofDetail.artifacts, ['kv_state', 'log_entry', 'log_bundle', 'file_artifact']);
  const computeCount = countArtifacts(proofDetail.artifacts, ['compute_result', 'compute_job']);
  const chainCount = countArtifacts(proofDetail.artifacts, ['chain_proof']);
  const postCount = countArtifacts(proofDetail.artifacts, ['post_result', 'post_payload']);
  const storageArtifacts = filterArtifacts(proofDetail.artifacts, [
    'kv_state',
    'log_entry',
    'log_bundle',
    'file_artifact',
    'manifest',
    'post_payload',
    'post_result',
  ]);
  const computeArtifacts = filterArtifacts(proofDetail.artifacts, ['compute_result', 'compute_job']);
  const chainArtifacts = filterArtifacts(proofDetail.artifacts, ['chain_proof']);
  const isRefreshing =
    proofFeed.isRefreshing ||
    proofDetail.isRefreshing ||
    topology.isRefreshing ||
    inftProof.isRefreshing;
  const selectedProof = proofFeed.proofs.find((proof) => proof.runId === activeRunId) ?? proofFeed.proofs[0] ?? null;
  const proofFinalization = proofDetail.proofFinalization ?? selectedProof?.proofFinalization ?? null;
  const isProofFinalizing = proofFinalization ? isProofFinalizingStatus(proofFinalization.status) : false;
  const proofStatusText = proofFinalization ? proofStatusLabel[proofFinalization.status] : 'unknown';
  const onlinePeers = topology.peers.filter((peer) => peer.status === 'online').length;
  const deliveredRoutes = topology.routes.filter((route) => route.deliveryStatus === 'delivered').length;
  const activeRunRoutes = activeRunId
    ? topology.routes.filter((route) => route.runId === activeRunId)
    : [];
  const isAxlUnverified = Boolean(topology.snapshot && !topology.isVerified);
  const axlStatusLabel = topology.isVerified ? 'verified' : isAxlUnverified ? 'unverified' : 'unknown';

  const overviewItems = [
    {
      label: '0G refs',
      value: proofDetail.artifacts.length.toString(),
      icon: Database,
      className: 'text-cyan-300',
    },
    {
      label: 'Storage',
      value: storageCount.toString(),
      icon: FileJson,
      className: 'text-purple-300',
    },
    {
      label: 'Compute',
      value: computeCount > 0 ? 'ready' : 'none',
      icon: Zap,
      className: computeCount > 0 ? 'text-green-300' : 'text-gray-500',
    },
    {
      label: 'Chain',
      value: chainArtifact ? 'anchored' : isProofFinalizing ? proofStatusText : 'not set',
      icon: Network,
      className: chainArtifact || isProofFinalizing ? 'text-orange-300' : 'text-gray-500',
    },
    {
      label: 'AXL peers',
      value: topology.isVerified ? `${onlinePeers}/${topology.peers.length}` : axlStatusLabel,
      icon: RadioTower,
      className: topology.isVerified && topology.peers.length > 0 ? 'text-cyan-300' : 'text-yellow-300',
    },
    {
      label: 'Services',
      value: topology.isVerified ? topology.services.length.toString() : axlStatusLabel,
      icon: Boxes,
      className: topology.isVerified && topology.services.length > 0 ? 'text-purple-300' : 'text-yellow-300',
    },
    {
      label: 'Routes',
      value: topology.isVerified ? `${deliveredRoutes}/${topology.routes.length}` : axlStatusLabel,
      icon: History,
      className: topology.isVerified && topology.routes.length > 0 ? 'text-green-300' : 'text-yellow-300',
    },
  ];

  const consoleSections = [
    {
      id: 'storage',
      label: '0G Storage',
      detail: `${storageCount} refs`,
      icon: FileJson,
    },
    {
      id: 'compute',
      label: '0G Compute',
      detail: computeCount > 0 ? `${computeCount} proofs` : 'none',
      icon: Zap,
    },
    {
      id: 'chain',
      label: '0G Chain',
      detail: chainCount > 0 ? 'anchored' : isProofFinalizing ? proofStatusText : 'not set',
      icon: Network,
    },
    {
      id: 'axl-peers',
      label: 'AXL Peer Graph',
      detail: topology.isVerified ? `${onlinePeers}/${topology.peers.length} online` : axlStatusLabel,
      icon: RadioTower,
    },
    {
      id: 'axl-trace',
      label: 'AXL Trace',
      detail: topology.isVerified ? `${activeRunRoutes.length} run routes` : axlStatusLabel,
      icon: GitBranch,
    },
    {
      id: 'axl-services',
      label: 'AXL Service Registry',
      detail: topology.isVerified ? `${topology.services.length} services` : axlStatusLabel,
      icon: Boxes,
    },
    {
      id: 'axl-routes',
      label: 'AXL Route Receipts',
      detail: topology.isVerified ? `${topology.routes.length} routes` : axlStatusLabel,
      icon: History,
    },
  ] satisfies Array<{
    id: ConsoleSectionId;
    label: string;
    detail: string;
    icon: typeof FileJson;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <HugeiconsIcon icon={Certificate01Icon} className="h-6 w-6 text-cyan-500" />
            Proof Console
          </h2>
          <p className="mt-1 max-w-3xl text-gray-400">
            Live 0G storage, compute, chain, and AXL routing evidence for recent swarm runs.
          </p>
        </div>
        {isRefreshing && <span className="text-xs text-gray-500">Syncing proof console...</span>}
      </div>

      {isAxlUnverified && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
              <div>
                <div className="text-sm font-semibold text-yellow-100">AXL evidence is unverified</div>
                <p className="mt-1 text-sm text-yellow-100/80">
                  {topology.unverifiedReason ??
                    'No live AXL service registry snapshot is available.'}
                </p>
              </div>
            </div>
            <Badge className="w-fit border-yellow-500/40 bg-yellow-500/10 text-yellow-200">
              {topology.source ?? 'axl-service-registry'}
            </Badge>
          </div>
        </div>
      )}

      {proofFinalization && proofFinalization.status !== 'complete' && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3',
            proofFinalization.status === 'failed'
              ? 'border-red-500/30 bg-red-500/10'
              : proofFinalization.status === 'partial'
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-cyan-500/30 bg-cyan-500/10',
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              {proofFinalization.status === 'failed' || proofFinalization.status === 'partial' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
              ) : (
                <History className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              )}
              <div>
                <div className="text-sm font-semibold text-white">
                  0G evidence {proofStatusText}
                </div>
                <p className="mt-1 text-sm text-gray-300">
                  {proofFinalization.error ??
                    'The run output is ready while storage, compute, manifest, and chain refs are still being finalized.'}
                </p>
              </div>
            </div>
            <Badge className={cn('w-fit uppercase', proofStatusBadgeClass[proofFinalization.status])}>
              {proofStatusText}
            </Badge>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                <HugeiconsIcon icon={Database01Icon} className="h-4 w-4 text-cyan-300" />
                Runs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {proofFeed.error && proofFeed.proofs.length === 0 ? (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-950/10 p-4 text-sm text-yellow-100">
                  Unable to load 0G run records.
                </div>
              ) : proofFeed.isLoading && proofFeed.proofs.length === 0 ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
                ))
              ) : proofFeed.proofs.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">
                  No 0G activity recorded yet.
                </div>
              ) : (
                paginatedProofs.map((proof) => {
                  const isActive = activeRunId === proof.runId;

                  return (
                    <button
                      key={proof.runId}
                      type="button"
                      onClick={() => {
                        setSelectedRunId(proof.runId);
                        setSearchParams({ runId: proof.runId, section: activeSection });
                      }}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        isActive
                          ? 'border-cyan-500/40 bg-cyan-500/10'
                          : 'border-gray-800 bg-gray-950/40 hover:border-gray-700 hover:bg-gray-900/60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-white">{shorten(proof.runId)}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatDateTime(proof.createdAt)}</div>
                        </div>
                        <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
                          {proof.artifactCount} refs
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-800 pt-3 text-xs">
                        <div>
                          <div className="text-gray-600">Signal</div>
                          <div className="truncate font-mono text-gray-400">{shorten(proof.finalSignalId)}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Intel</div>
                          <div className="truncate font-mono text-gray-400">{shorten(proof.finalIntelId)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
              {proofFeed.proofs.length > RUNS_PER_PAGE && (
                <div className="flex items-center justify-between border-t border-gray-800 pt-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                    Page {runPage} of {runPageCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRunPage((page) => Math.max(1, page - 1))}
                      disabled={runPage === 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-950/60 text-gray-400 transition-colors hover:border-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous runs page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRunPage((page) => Math.min(runPageCount, page + 1))}
                      disabled={runPage === runPageCount}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-950/60 text-gray-400 transition-colors hover:border-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next runs page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Console
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {consoleSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-white'
                        : 'border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:bg-gray-900/60 hover:text-white',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-cyan-300' : 'text-gray-500')} />
                      <span className="truncate text-sm font-medium">{section.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase text-gray-500">
                      {section.detail}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                <HugeiconsIcon icon={Link01Icon} className="h-4 w-4 text-cyan-300" />
                Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Manifest</div>
                <div className="mt-1 truncate font-mono text-sm text-white">{shorten(manifestArtifact?.id)}</div>
              </div>
              {publishedUrl && (
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-sm text-cyan-300 hover:border-cyan-500/40 hover:text-cyan-200"
                >
                  Published post
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-sm text-cyan-300 hover:border-cyan-500/40 hover:text-cyan-200"
                >
                  Chain explorer
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {!publishedUrl && !explorerUrl && (
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-sm text-gray-500">
                  Links appear after a post or chain anchor is available.
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <InftProofCard
            proof={inftProof.proof}
            isLoading={inftProof.isLoading}
            error={inftProof.error}
          />

          <Card className="border-gray-800 bg-gray-900/40">
            <CardContent className="p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {proofDetail.error ? (
                        <ServerCrash className="h-4 w-4 text-yellow-300" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-300" />
                      )}
                      <span>{proofDetail.error ? 'Run record unavailable' : 'Run record loaded'}</span>
                    </div>
                    <div className="mt-2 truncate font-mono text-lg text-white">{shorten(activeRunId)}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>{formatDateTime(selectedProof?.createdAt)}</span>
                      <span>Signal {shorten(selectedProof?.finalSignalId)}</span>
                      <span>Intel {shorten(selectedProof?.finalIntelId)}</span>
                    </div>
                  </div>
                  <Badge className="w-fit border-gray-700 bg-gray-950/60 text-gray-300">
                    {postCount > 0 ? `${postCount} post refs` : 'no post refs'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {overviewItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          <Icon className={cn('h-3.5 w-3.5', item.className)} />
                          {item.label}
                        </div>
                        <div className="mt-2 font-mono text-sm text-white">{item.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-7">
            {consoleSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left transition-colors',
                    isActive
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-gray-800 bg-gray-950/30 hover:border-gray-700 hover:bg-gray-900/50',
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive ? 'text-cyan-300' : 'text-gray-500')} />
                  <div className="mt-2 text-xs font-semibold text-white">{section.label}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase text-gray-500">{section.detail}</div>
                </button>
              );
            })}
          </div>

          {activeSection === 'storage' && (
            <div className="space-y-6">
              <RunManifestPanel
                manifest={proofDetail.manifest}
                isLoading={proofDetail.isLoading}
                error={proofDetail.error}
                emptyMessage={
                  isProofFinalizing
                    ? '0G manifest is still being assembled for this run.'
                    : 'No run manifest has been assembled yet.'
                }
                emptyStatus={isProofFinalizing ? 'FINALIZING' : 'NO MANIFEST'}
              />
              <ArtifactList
                artifacts={storageArtifacts}
                title="0G Storage Refs"
                isLoading={proofDetail.isLoading}
                error={proofDetail.error}
                emptyMessage={
                  isProofFinalizing
                    ? '0G storage refs are still being recorded for this run.'
                    : 'No 0G artifact refs recorded.'
                }
              />
            </div>
          )}

          {activeSection === 'compute' && (
            <div className="space-y-6">
              <ComputeProofCard
                artifact={computeArtifact}
                isLoading={proofDetail.isLoading}
                error={proofDetail.error}
              />
              <ArtifactList
                artifacts={computeArtifacts}
                title="0G Compute Refs"
                isLoading={proofDetail.isLoading}
                error={proofDetail.error}
                emptyMessage={
                  isProofFinalizing
                    ? '0G compute proof is still being recorded for this run.'
                    : 'No 0G artifact refs recorded.'
                }
              />
            </div>
          )}

          {activeSection === 'chain' && (
            <div className="space-y-6">
              <ChainAnchorCard
                anchor={chainArtifact}
                isLoading={proofDetail.isLoading}
                error={proofDetail.error}
                emptyMessage={
                  isProofFinalizing
                    ? '0G chain anchor is queued after the manifest is recorded.'
                    : 'This manifest has no chain anchor.'
                }
                emptyStatus={isProofFinalizing ? proofStatusText : 'not set'}
              />
              <ArtifactList
                artifacts={chainArtifacts}
                title="0G Chain Refs"
                isLoading={proofDetail.isLoading}
                error={proofDetail.error}
                emptyMessage={
                  isProofFinalizing
                    ? '0G chain ref is still being recorded for this run.'
                    : 'No 0G artifact refs recorded.'
                }
              />
            </div>
          )}

          {activeSection.startsWith('axl-') && isAxlUnverified && (
            <Card className="border-yellow-500/25 bg-yellow-950/10">
              <CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="mb-3 h-8 w-8 text-yellow-300/80" />
                <div className="text-sm font-semibold text-yellow-100">Verified AXL snapshot required</div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-yellow-100/70">
                  {topology.unverifiedReason ??
                    'AXL peer, service, and route panels only render live service-registry snapshots.'}
                </p>
              </CardContent>
            </Card>
          )}

          {activeSection === 'axl-trace' && !isAxlUnverified && (
            <AxlTraceView
              routes={topology.routes}
              activeRunId={activeRunId}
              finalSignalId={selectedProof?.finalSignalId ?? proofDetail.run?.finalSignalId ?? null}
              finalIntelId={selectedProof?.finalIntelId ?? proofDetail.run?.finalIntelId ?? null}
              capturedAt={topology.capturedAt}
              isLoading={topology.isLoading}
              error={topology.error}
            />
          )}

          {activeSection === 'axl-peers' && !isAxlUnverified && (
            <PeerTopologyPanel
              nodes={topology.nodes}
              peers={topology.peers}
              capturedAt={topology.capturedAt}
              isLoading={topology.isLoading}
              error={topology.error}
            />
          )}

          {activeSection === 'axl-services' && !isAxlUnverified && (
            <ServiceRegistryPanel
              services={topology.services}
              capturedAt={topology.capturedAt}
              isLoading={topology.isLoading}
              error={topology.error}
            />
          )}

          {activeSection === 'axl-routes' && !isAxlUnverified && (
            <RouteTimeline
              routes={topology.routes}
              isLoading={topology.isLoading}
              error={topology.error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
