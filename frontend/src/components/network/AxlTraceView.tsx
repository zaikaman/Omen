import { CheckCircle2, GitBranch, Network, RadioTower, ServerCrash, XCircle } from 'lucide-react';

import type { AxlRouteRecord } from '../../lib/api/topology';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';

type AxlTraceViewProps = {
  routes?: AxlRouteRecord[];
  activeRunId?: string | null;
  finalSignalId?: string | null;
  finalIntelId?: string | null;
  capturedAt?: string | null;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

type TraceChain = {
  id: string;
  routes: AxlRouteRecord[];
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  outputRefs: AxlRouteRecord['outputRefs'];
  topologyPeerIds: string[];
};

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'pending';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
};

const buildTraceChains = (routes: AxlRouteRecord[]): TraceChain[] => {
  const chains = new Map<string, AxlRouteRecord[]>();

  for (const route of routes) {
    const chainId = route.routeChainId ?? route.delegationId ?? route.correlationId ?? route.runId ?? 'unbound';
    chains.set(chainId, [...(chains.get(chainId) ?? []), route]);
  }

  return Array.from(chains.entries())
    .map(([id, chainRoutes]) => {
      const orderedRoutes = [...chainRoutes].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
      const outputRefs = orderedRoutes.flatMap((route) => route.outputRefs);
      const topologyPeerIds = Array.from(
        new Set(orderedRoutes.flatMap((route) => route.topologyPeerIds)),
      ).sort();
      const failedAt = orderedRoutes.find((route) => route.failedAt)?.failedAt ?? null;
      const completedAt = [...orderedRoutes].reverse().find((route) => route.completedAt)?.completedAt ?? null;

      return {
        id,
        routes: orderedRoutes,
        startedAt: orderedRoutes[0]?.acceptedAt ?? orderedRoutes[0]?.observedAt ?? '',
        completedAt,
        failedAt,
        outputRefs,
        topologyPeerIds,
      };
    })
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
};

const routeStatusClassName = (route: AxlRouteRecord) =>
  route.deliveryStatus === 'failed'
    ? 'text-red-300'
    : route.deliveryStatus === 'delivered'
      ? 'text-green-300'
      : 'text-cyan-300';

export function AxlTraceView({
  routes = [],
  activeRunId,
  finalSignalId,
  finalIntelId,
  capturedAt,
  isLoading,
  error,
  className,
}: AxlTraceViewProps) {
  const runRoutes = activeRunId ? routes.filter((route) => route.runId === activeRunId) : routes;
  const chains = buildTraceChains(runRoutes);
  const rawPeerIds = Array.from(new Set(runRoutes.flatMap((route) => route.topologyPeerIds))).sort();
  const linkedOutputRefs = Array.from(
    new Map(
      [
        ...(finalSignalId ? [{ kind: 'signal' as const, id: finalSignalId }] : []),
        ...(finalIntelId ? [{ kind: 'intel' as const, id: finalIntelId }] : []),
        ...runRoutes.flatMap((route) => route.outputRefs),
      ].map((ref) => [`${ref.kind}:${ref.id}`, ref]),
    ).values(),
  );
  const failedChains = chains.filter((chain) => chain.failedAt).length;

  if (isLoading && routes.length === 0) {
    return (
      <Card className={cn('border-gray-800 bg-gray-900/50', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase text-gray-400">
            <GitBranch className="h-4 w-4 text-cyan-400" />
            AXL Trace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-gray-800 bg-gray-900/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <GitBranch className="h-4 w-4 text-cyan-400" />
              AXL Trace
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {activeRunId ? `Run ${shorten(activeRunId)}` : 'Latest route chains'} / {formatDateTime(capturedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200">{chains.length} chains</Badge>
            <Badge className="border-green-500/40 bg-green-500/10 text-green-300">{linkedOutputRefs.length} outputs</Badge>
            {failedChains > 0 && (
              <Badge className="border-red-500/40 bg-red-500/10 text-red-300">{failedChains} failed</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && routes.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load AXL trace evidence.</p>
          </div>
        ) : runRoutes.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <RadioTower className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">No AXL trace routes for this run yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Raw topology peers</div>
                <div className="mt-1 font-mono text-lg text-cyan-200">{rawPeerIds.length}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Final signal</div>
                <div className="mt-1 truncate font-mono text-sm text-white">{shorten(finalSignalId)}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Final intel</div>
                <div className="mt-1 truncate font-mono text-sm text-white">{shorten(finalIntelId)}</div>
              </div>
            </div>

            <ScrollArea className="h-[520px] pr-3">
              <div className="space-y-4">
                {chains.map((chain) => (
                  <div key={chain.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {chain.failedAt ? (
                            <XCircle className="h-4 w-4 text-red-300" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-300" />
                          )}
                          <span className="truncate font-mono text-sm text-white">{shorten(chain.id)}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {formatDateTime(chain.startedAt)} {'->'} {formatDateTime(chain.failedAt ?? chain.completedAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {chain.outputRefs.length > 0 ? (
                          chain.outputRefs.map((ref) => (
                            <Badge key={`${chain.id}-${ref.kind}-${ref.id}`} className="border-purple-500/40 bg-purple-500/10 text-purple-200">
                              {ref.kind} {shorten(ref.id)}
                            </Badge>
                          ))
                        ) : (
                          <Badge className="border-gray-700 bg-gray-900 text-gray-400">no output link</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {chain.routes.map((route) => (
                        <div
                          key={`${route.observedAt}-${route.destinationPeerId ?? route.peerId}-${route.method ?? route.operation}`}
                          className="grid gap-3 rounded border border-gray-800 bg-gray-900/50 p-3 text-xs lg:grid-cols-[1fr_1.3fr_1fr]"
                        >
                          <div>
                            <div className="text-gray-600">Method</div>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">{route.kind}</Badge>
                              <span className="font-mono text-gray-200">{route.method ?? route.operation}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Peer route</div>
                            <div className="mt-1 flex items-center gap-2 font-mono text-gray-300">
                              <span className="truncate">{shorten(route.sourcePeerId)}</span>
                              <Network className="h-3.5 w-3.5 shrink-0 text-gray-600" />
                              <span className="truncate">{shorten(route.destinationPeerId ?? route.peerId)}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">State</div>
                            <div className={cn('mt-1 font-mono uppercase', routeStatusClassName(route))}>
                              {route.deliveryStatus}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
