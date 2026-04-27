import type { ChainProof, ProofArtifact, ZeroGChainAnchorLink } from '@omen/shared';
import { Anchor, ExternalLink, Link2Off, ServerCrash } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

type ChainAnchorCardProps = {
  anchor?: ChainProof | ProofArtifact | ZeroGChainAnchorLink | null;
  title?: string;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

const statusClassName: Record<ChainProof['status'], string> = {
  pending: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
  anchored: 'border-green-500/40 bg-green-500/10 text-green-300',
  skipped: 'border-gray-500/40 bg-gray-500/10 text-gray-300',
  failed: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'NOT ANCHORED';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isChainProof = (value: unknown): value is ChainProof => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.manifestRoot === 'string' &&
    typeof value.chainId === 'string' &&
    (value.status === 'pending' || value.status === 'anchored' || value.status === 'skipped' || value.status === 'failed')
  );
};

const metadataString = (metadata: Record<string, unknown>, key: string) =>
  typeof metadata[key] === 'string' ? metadata[key] : null;

const metadataNumber = (metadata: Record<string, unknown>, key: string) =>
  typeof metadata[key] === 'number' ? metadata[key] : null;

const proofFromArtifact = (artifact: ProofArtifact): ChainProof | null => {
  if (isChainProof(artifact.metadata)) {
    return artifact.metadata;
  }

  const status = metadataString(artifact.metadata, 'status');

  if (status !== 'pending' && status !== 'anchored' && status !== 'skipped' && status !== 'failed') {
    return null;
  }

  return {
    manifestRoot: metadataString(artifact.metadata, 'manifestRoot') ?? artifact.key ?? artifact.id,
    chainId: metadataString(artifact.metadata, 'chainId') ?? 'unknown',
    status,
    contractAddress: metadataString(artifact.metadata, 'contractAddress'),
    transactionHash: metadataString(artifact.metadata, 'transactionHash'),
    blockNumber: metadataNumber(artifact.metadata, 'blockNumber'),
    explorerUrl: metadataString(artifact.metadata, 'explorerUrl'),
    anchoredAt: metadataString(artifact.metadata, 'anchoredAt') ?? null,
  };
};

const resolveAnchor = (anchor: ChainAnchorCardProps['anchor']) => {
  if (!anchor) {
    return null;
  }

  if (isChainProof(anchor)) {
    return anchor;
  }

  if ('artifact' in anchor) {
    return proofFromArtifact(anchor.artifact);
  }

  return proofFromArtifact(anchor);
};

export function ChainAnchorCard({
  anchor,
  title = 'Optional Chain Anchor',
  isLoading,
  error,
  className,
}: ChainAnchorCardProps) {
  const proof = resolveAnchor(anchor);

  if (isLoading && !proof) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <Anchor className="h-4 w-4 text-orange-300" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <Anchor className="h-4 w-4 text-orange-300" />
              {title}
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {error ? 'Anchor unavailable' : `Anchored ${formatDateTime(proof?.anchoredAt)}`}
            </p>
          </div>
          <Badge className={proof ? cn('uppercase', statusClassName[proof.status]) : 'border-gray-500/40 bg-gray-500/10 text-gray-300'}>
            {proof ? proof.status : 'not set'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && !proof ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load chain anchor.</p>
          </div>
        ) : !proof ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <Link2Off className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">This manifest has no chain anchor.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm text-white">{shorten(proof.manifestRoot)}</div>
                <div className="mt-1 text-xs text-gray-500">Chain {proof.chainId}</div>
              </div>
              {proof.explorerUrl && (
                <a
                  href={proof.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                >
                  Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="mt-4 grid gap-3 border-t border-gray-800 pt-3 text-xs sm:grid-cols-3">
              <div>
                <div className="text-gray-600">Contract</div>
                <div className="mt-1 truncate font-mono text-gray-300">{shorten(proof.contractAddress)}</div>
              </div>
              <div>
                <div className="text-gray-600">Transaction</div>
                <div className="mt-1 truncate font-mono text-gray-300">{shorten(proof.transactionHash)}</div>
              </div>
              <div>
                <div className="text-gray-600">Block</div>
                <div className="mt-1 font-mono text-gray-300">{proof.blockNumber ?? 'pending'}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
