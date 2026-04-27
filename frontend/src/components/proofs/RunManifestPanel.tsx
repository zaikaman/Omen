import type { ZeroGRunManifest } from '@omen/shared';
import { FileCheck2, Layers, ServerCrash, ShieldCheck } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

type RunManifestPanelProps = {
  manifest?: ZeroGRunManifest | null;
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

export function RunManifestPanel({ manifest, isLoading, error, className }: RunManifestPanelProps) {
  if (isLoading && !manifest) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <FileCheck2 className="h-4 w-4 text-cyan-400" />
            0G Run Manifest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
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
              <FileCheck2 className="h-4 w-4 text-cyan-400" />
              0G Run Manifest
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {error ? 'Manifest unavailable' : `Created ${formatDateTime(manifest?.createdAt)}`}
            </p>
          </div>
          <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            {manifest ? `${manifest.summary.artifactCount} ARTIFACTS` : 'NO MANIFEST'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && !manifest ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load 0G manifest.</p>
          </div>
        ) : !manifest ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <Layers className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">No run manifest has been assembled yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Checkpoints</div>
                <div className="mt-1 font-mono text-xl text-cyan-300">{manifest.checkpoints.length}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Logs</div>
                <div className="mt-1 font-mono text-xl text-white">{manifest.logs.length}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Files</div>
                <div className="mt-1 font-mono text-xl text-purple-300">{manifest.files.length}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Compute</div>
                <div className="mt-1 font-mono text-xl text-green-300">{manifest.computeProofs.length}</div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm text-white">{manifest.namespace.path}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Run {shorten(manifest.runId)} / status {manifest.summary.status.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-gray-800 pt-3 text-xs sm:grid-cols-3">
                <div>
                  <div className="text-gray-600">Manifest Ref</div>
                  <div className="mt-1 truncate font-mono text-gray-300">{shorten(manifest.manifestArtifact?.artifact.id)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Signal</div>
                  <div className="mt-1 truncate font-mono text-gray-300">{shorten(manifest.summary.finalSignalId)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Intel</div>
                  <div className="mt-1 truncate font-mono text-gray-300">{shorten(manifest.summary.finalIntelId)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
