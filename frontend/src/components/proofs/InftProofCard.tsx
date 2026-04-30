import { Bot, ExternalLink, Fingerprint, KeyRound, LockKeyhole, ServerCrash } from 'lucide-react';

import type { InftProofResponse } from '../../lib/api/inft';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type InftProofCardProps = {
  proof: InftProofResponse | null;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 30 ? `${value.slice(0, 16)}...${value.slice(-8)}` : value;
};

const proofRows = (proof: InftProofResponse) => [
  {
    label: 'Encrypted intelligence',
    value: proof.encryptedIntelligenceUri,
    icon: LockKeyhole,
  },
  {
    label: 'Memory root',
    value: proof.memoryRoot,
    icon: Fingerprint,
  },
  {
    label: 'Attestor',
    value: proof.attestorAddress,
    icon: KeyRound,
  },
];

export function InftProofCard({
  proof,
  isLoading,
  error,
  className,
}: InftProofCardProps) {
  if (isLoading && !proof) {
    return (
      <Card className={cn('border-gray-800 bg-gray-900/50', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <Bot className="h-4 w-4 text-cyan-300" />
            Swarm iNFT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-gray-800 bg-gray-900/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <Bot className="h-4 w-4 text-cyan-300" />
              Swarm iNFT
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {proof?.configured
                ? `Token ${proof.tokenId ?? 'unknown'} on 0G chain ${proof.chainId}`
                : 'iNFT proof not configured'}
            </p>
          </div>
          <Badge
            className={
              proof?.configured
                ? 'border-green-500/40 bg-green-500/10 text-green-300'
                : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'
            }
          >
            {proof?.configured ? 'MINTED' : 'PENDING'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && !proof ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load iNFT proof.</p>
          </div>
        ) : !proof?.configured ? (
          <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">
            Minted iNFT details appear after backend iNFT config is set.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Contract
                  </div>
                  <div className="mt-1 truncate font-mono text-sm text-white">
                    {shorten(proof.contractAddress)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Owner {shorten(proof.ownerAddress)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {proof.mintExplorerUrl && (
                    <a
                      href={proof.mintExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200 hover:border-cyan-400/50"
                    >
                      Mint tx
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {proof.contractExplorerUrl && (
                    <a
                      href={proof.contractExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-gray-700 bg-gray-950/60 px-2.5 py-1.5 text-xs text-gray-300 hover:border-gray-600"
                    >
                      Contract
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {proofRows(proof).map((row) => {
                const Icon = row.icon;

                return (
                  <div key={row.label} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <Icon className="h-3.5 w-3.5 text-cyan-300" />
                      {row.label}
                    </div>
                    <div className="mt-2 truncate font-mono text-xs text-gray-200">
                      {shorten(row.value)}
                    </div>
                  </div>
                );
              })}
            </div>

            {proof.latestRunId && (
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Embedded run memory
                </div>
                <div className="mt-1 truncate font-mono text-xs text-gray-300">
                  {proof.latestRunId}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
