import type { ProofArtifact, ZeroGRunManifest } from '@omen/shared';
import { Archive, Cpu, FileCheck2, ShieldCheck } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

type SponsorProofSummaryProps = {
  title: string;
  runId?: string | null;
  artifacts?: ProofArtifact[];
  manifest?: ZeroGRunManifest | null;
  proofRefIds?: string[];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 22 ? `${value.slice(0, 12)}...${value.slice(-6)}` : value;
};

const latestArtifact = (artifacts: ProofArtifact[]) =>
  [...artifacts].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

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

export function SponsorProofSummary({
  title,
  runId,
  artifacts = [],
  manifest,
  proofRefIds = [],
  isLoading,
  error,
  className,
}: SponsorProofSummaryProps) {
  const computeCount = artifacts.filter(
    (artifact) => artifact.refType === 'compute_job' || artifact.refType === 'compute_result',
  ).length;
  const manifestRefId =
    manifest?.manifestArtifact?.artifact.id ??
    artifacts.find((artifact) => artifact.refType === 'manifest')?.id ??
    null;
  const latest = latestArtifact(artifacts);
  const linkedRefIds = proofRefIds.length > 0 ? proofRefIds : artifacts.map((artifact) => artifact.id);

  if (isLoading && artifacts.length === 0) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
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
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              {title}
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {error
                ? 'Proof data unavailable'
                : runId
                  ? `Run ${shorten(runId)} / updated ${formatDateTime(latest?.createdAt ?? manifest?.createdAt)}`
                  : 'No run selected'}
            </p>
          </div>
          <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            {artifacts.length} REFS
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && artifacts.length === 0 ? (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-950/10 p-4 text-sm text-yellow-100">
            Unable to load 0G sponsor proof data.
          </div>
        ) : !runId ? (
          <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">
            Sponsor proof refs will appear after a run is selected.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <FileCheck2 className="h-3 w-3 text-cyan-300" />
                  Manifest
                </div>
                <div className="mt-2 truncate font-mono text-sm text-white">{shorten(manifestRefId)}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <Archive className="h-3 w-3 text-purple-300" />
                  Artifacts
                </div>
                <div className="mt-2 font-mono text-sm text-white">{artifacts.length}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <Cpu className="h-3 w-3 text-green-300" />
                  Compute
                </div>
                <div className="mt-2 font-mono text-sm text-white">{computeCount}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Checkpoint</div>
                <div className="mt-2 truncate font-mono text-sm text-white">
                  {shorten(manifest?.checkpoints[0]?.artifact.id ?? artifacts.find((artifact) => artifact.refType === 'kv_state')?.id)}
                </div>
              </div>
            </div>

            {linkedRefIds.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-gray-800 pt-3">
                {linkedRefIds.slice(0, 6).map((refId) => (
                  <Badge
                    key={refId}
                    variant="outline"
                    className="border-gray-700 bg-gray-950/50 font-mono text-[10px] text-gray-300"
                  >
                    {shorten(refId)}
                  </Badge>
                ))}
                {linkedRefIds.length > 6 && (
                  <Badge variant="outline" className="border-gray-700 bg-gray-950/50 text-[10px] text-gray-500">
                    +{linkedRefIds.length - 6} more
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
