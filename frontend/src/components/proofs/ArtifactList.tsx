import type { ProofArtifact, ZeroGArtifactLink } from '@omen/shared';
import { Archive, Box, Cpu, Database, FileText, ListChecks, ServerCrash } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';

type ArtifactListProps = {
  artifacts?: ProofArtifact[];
  links?: ZeroGArtifactLink[];
  title?: string;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

const refTypeClassName: Record<ProofArtifact['refType'], string> = {
  kv_state: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
  log_entry: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  log_bundle: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  file_artifact: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  compute_job: 'border-green-500/40 bg-green-500/10 text-green-200',
  compute_result: 'border-green-500/40 bg-green-500/10 text-green-200',
  post_payload: 'border-pink-500/40 bg-pink-500/10 text-pink-200',
  post_result: 'border-pink-500/40 bg-pink-500/10 text-pink-200',
  manifest: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
  chain_proof: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
};

const categoryIcon = (refType: ProofArtifact['refType']) => {
  if (refType === 'kv_state') {
    return Database;
  }

  if (refType === 'compute_job' || refType === 'compute_result') {
    return Cpu;
  }

  if (refType === 'manifest' || refType === 'file_artifact') {
    return FileText;
  }

  return Box;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
};

export function ArtifactList({
  artifacts = [],
  links,
  title = '0G Artifact Refs',
  isLoading,
  error,
  className,
}: ArtifactListProps) {
  const normalizedArtifacts = links?.map((link) => link.artifact) ?? artifacts;
  const orderedArtifacts = [...normalizedArtifacts].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const linkedLabels = new Map(links?.map((link) => [link.artifact.id, link.label]) ?? []);

  if (isLoading && orderedArtifacts.length === 0) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <Archive className="h-4 w-4 text-purple-300" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
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
              <Archive className="h-4 w-4 text-purple-300" />
              {title}
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">KV, log, file, compute, manifest, and post refs</p>
          </div>
          <Badge className="border-purple-500/40 bg-purple-500/10 text-purple-200">
            {orderedArtifacts.length} REFS
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && orderedArtifacts.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load 0G artifact refs.</p>
          </div>
        ) : orderedArtifacts.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <ListChecks className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">No 0G artifact refs recorded.</p>
          </div>
        ) : (
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-2">
              {orderedArtifacts.map((artifact) => {
                const Icon = categoryIcon(artifact.refType);

                return (
                  <div key={artifact.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-gray-500" />
                          <span className="truncate font-mono text-sm text-white">
                            {linkedLabels.get(artifact.id) ?? artifact.key ?? artifact.id}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-500">{artifact.locator}</div>
                      </div>
                      <Badge className={cn('shrink-0 uppercase', refTypeClassName[artifact.refType])}>
                        {artifact.refType.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-gray-800 pt-3 text-xs sm:grid-cols-3">
                      <div>
                        <div className="text-gray-600">Created</div>
                        <div className="font-mono text-gray-400">{formatDateTime(artifact.createdAt)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Run</div>
                        <div className="font-mono text-gray-400">{shorten(artifact.runId)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Subject</div>
                        <div className="font-mono text-gray-400">{shorten(artifact.signalId ?? artifact.intelId)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
