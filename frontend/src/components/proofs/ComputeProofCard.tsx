import type { ComputeProof, ComputeProofRecord, ProofArtifact } from '@omen/shared';
import { Cpu, ServerCrash, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

type ComputeProofCardProps = {
  artifact?: ProofArtifact | null;
  proof?: ComputeProof | ComputeProofRecord | null;
  title?: string;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
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

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
};

const isComputeProofRecord = (proof: ComputeProof | ComputeProofRecord): proof is ComputeProofRecord =>
  'artifactId' in proof;

export function ComputeProofCard({
  artifact,
  proof,
  title = '0G Compute Verification',
  isLoading,
  error,
  className,
}: ComputeProofCardProps) {
  const compute = proof ?? artifact?.compute ?? null;
  const hasHashes = Boolean(compute?.requestHash && compute.responseHash);
  const recordedAt = compute && isComputeProofRecord(compute) ? compute.recordedAt : artifact?.createdAt;

  if (isLoading && !compute) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <Cpu className="h-4 w-4 text-green-300" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
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
              <Cpu className="h-4 w-4 text-green-300" />
              {title}
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {error ? 'Compute proof unavailable' : `Recorded ${formatDateTime(recordedAt)}`}
            </p>
          </div>
          <Badge
            className={cn(
              hasHashes
                ? 'border-green-500/40 bg-green-500/10 text-green-300'
                : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
            )}
          >
            {hasHashes ? 'HASHED' : 'PARTIAL'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && !compute ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load compute verification.</p>
          </div>
        ) : !compute ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <ShieldAlert className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">No 0G Compute proof recorded.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm text-white">{compute.provider}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {compute.model} / job {shorten(compute.jobId)}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-gray-800 pt-3 text-xs sm:grid-cols-3">
                <div>
                  <div className="text-gray-600">Mode</div>
                  <div className="mt-1 font-mono text-gray-300">{compute.verificationMode ?? 'unverified'}</div>
                </div>
                <div>
                  <div className="text-gray-600">Request Hash</div>
                  <div className="mt-1 truncate font-mono text-gray-300">{shorten(compute.requestHash)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Response Hash</div>
                  <div className="mt-1 truncate font-mono text-gray-300">{shorten(compute.responseHash)}</div>
                </div>
              </div>
            </div>
            {compute && isComputeProofRecord(compute) && (
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-xs">
                <div className="text-gray-600">Output Preview</div>
                <p className="mt-1 line-clamp-3 leading-relaxed text-gray-300">{compute.outputPreview}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
