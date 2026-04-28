import { useMemo, useState } from 'react';
import type { ProofArtifact } from '@omen/shared';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Certificate01Icon,
  Database01Icon,
  Link01Icon,
} from '@hugeicons/core-free-icons';
import { CheckCircle2, Database, ExternalLink, FileJson, Network, ServerCrash, Zap } from 'lucide-react';

import { ArtifactList } from '../components/proofs/ArtifactList';
import { ChainAnchorCard } from '../components/proofs/ChainAnchorCard';
import { ComputeProofCard } from '../components/proofs/ComputeProofCard';
import { RunManifestPanel } from '../components/proofs/RunManifestPanel';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useProofDetail, useProofFeed } from '../hooks/useProofs';
import { cn } from '../lib/utils';

const REFRESH_INTERVAL_MS = 30_000;

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

export function EvidencePage() {
  const proofFeed = useProofFeed({
    limit: 10,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const activeRunId = selectedRunId ?? proofFeed.proofs[0]?.runId ?? null;
  const proofDetail = useProofDetail(activeRunId, {
    enabled: Boolean(activeRunId),
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });

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
  const postCount = countArtifacts(proofDetail.artifacts, ['post_result', 'post_payload']);
  const isRefreshing = proofFeed.isRefreshing || proofDetail.isRefreshing;
  const selectedProof = proofFeed.proofs.find((proof) => proof.runId === activeRunId) ?? proofFeed.proofs[0] ?? null;

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
      value: chainArtifact ? 'anchored' : 'not set',
      icon: Network,
      className: chainArtifact ? 'text-orange-300' : 'text-gray-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <HugeiconsIcon icon={Certificate01Icon} className="h-6 w-6 text-cyan-500" />
            0G Activity
          </h2>
          <p className="mt-1 max-w-3xl text-gray-400">
            Runtime storage, compute, and chain records for recent swarm runs.
          </p>
        </div>
        {isRefreshing && <span className="text-xs text-gray-500">Syncing 0G activity...</span>}
      </div>

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
                proofFeed.proofs.map((proof) => {
                  const isActive = activeRunId === proof.runId;

                  return (
                    <button
                      key={proof.runId}
                      type="button"
                      onClick={() => setSelectedRunId(proof.runId)}
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

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <RunManifestPanel
              manifest={proofDetail.manifest}
              isLoading={proofDetail.isLoading}
              error={proofDetail.error}
            />
            <ComputeProofCard
              artifact={computeArtifact}
              isLoading={proofDetail.isLoading}
              error={proofDetail.error}
            />
          </div>

          <ChainAnchorCard
            anchor={chainArtifact}
            isLoading={proofDetail.isLoading}
            error={proofDetail.error}
          />

          <ArtifactList
            artifacts={proofDetail.artifacts}
            title="0G Refs"
            isLoading={proofDetail.isLoading}
            error={proofDetail.error}
          />
        </div>
      </div>
    </div>
  );
}
