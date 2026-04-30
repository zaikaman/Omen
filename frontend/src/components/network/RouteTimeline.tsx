import { GitBranch, History, ServerCrash, Waypoints } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';

export type AxlRouteKind = 'send' | 'mcp' | 'a2a';
export type AxlRouteDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export type AxlRouteRecord = {
  kind: AxlRouteKind;
  peerId: string;
  sourcePeerId?: string | null;
  destinationPeerId?: string | null;
  role?: string | null;
  service: string | null;
  method?: string | null;
  operation: string;
  runId: string | null;
  correlationId: string | null;
  delegationId?: string | null;
  routeChainId?: string | null;
  deliveryStatus: AxlRouteDeliveryStatus;
  observedAt: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  topologyPeerIds?: string[];
  outputRefs?: Array<{ kind: 'signal' | 'intel'; id: string }>;
  metadata: Record<string, unknown>;
};

type RouteTimelineProps = {
  routes?: AxlRouteRecord[];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

const kindClassName: Record<AxlRouteKind, string> = {
  send: 'border-gray-500/40 bg-gray-500/10 text-gray-200',
  mcp: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
  a2a: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
};

const deliveryClassName: Record<AxlRouteDeliveryStatus, string> = {
  queued: 'text-gray-400',
  sent: 'text-blue-300',
  delivered: 'text-green-300',
  failed: 'text-red-300',
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));

const shorten = (value: string | null | undefined) => {
  if (!value) {
    return 'none';
  }

  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
};

export function RouteTimeline({ routes = [], isLoading, error, className }: RouteTimelineProps) {
  const orderedRoutes = [...routes].sort((left, right) => right.observedAt.localeCompare(left.observedAt));
  const deliveredRoutes = routes.filter((route) => route.deliveryStatus === 'delivered').length;
  const failedRoutes = routes.filter((route) => route.deliveryStatus === 'failed').length;

  if (isLoading && routes.length === 0) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <History className="h-4 w-4 text-cyan-400" />
            Route History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
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
              <History className="h-4 w-4 text-cyan-400" />
              Route History
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">AXL send, MCP, and A2A route receipts</p>
          </div>
          <Badge className="border-green-500/40 bg-green-500/10 text-green-300">
            {deliveredRoutes}/{routes.length} DELIVERED
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && routes.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load route history.</p>
          </div>
        ) : routes.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <Waypoints className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">No AXL route receipts yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Routes</div>
                <div className="mt-1 font-mono text-lg text-white">{routes.length}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Failures</div>
                <div className="mt-1 font-mono text-lg text-red-300">{failedRoutes}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Runs</div>
                <div className="mt-1 font-mono text-lg text-cyan-300">
                  {new Set(routes.map((route) => route.runId).filter(Boolean)).size}
                </div>
              </div>
            </div>

            <ScrollArea className="h-[360px] pr-3">
              <div className="relative space-y-3 pl-5">
                <div className="absolute bottom-3 left-1.5 top-3 w-px bg-gray-800" />
                {orderedRoutes.map((route) => (
                  <div
                    key={`${route.observedAt}-${route.peerId}-${route.operation}-${route.correlationId ?? 'none'}`}
                    className="relative rounded-lg border border-gray-800 bg-gray-950/40 p-3"
                  >
                    <div className="absolute -left-[19px] top-4 flex h-3 w-3 items-center justify-center rounded-full border border-cyan-500/50 bg-gray-950">
                      <GitBranch className="h-2 w-2 text-cyan-300" />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn('uppercase', kindClassName[route.kind])}>{route.kind}</Badge>
                          <span className="font-mono text-sm text-white">{route.method ?? route.operation}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-500">
                          {route.sourcePeerId ? `${shorten(route.sourcePeerId)} -> ` : ''}
                          {shorten(route.destinationPeerId ?? route.peerId)} / {route.service ?? route.role ?? 'direct'}
                        </div>
                      </div>
                      <span className={cn('shrink-0 font-mono text-xs uppercase', deliveryClassName[route.deliveryStatus])}>
                        {route.deliveryStatus}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-gray-800 pt-3 text-xs sm:grid-cols-3">
                      <div>
                        <div className="text-gray-600">Observed</div>
                        <div className="font-mono text-gray-400">{formatDateTime(route.observedAt)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Run</div>
                        <div className="font-mono text-gray-400">{shorten(route.runId)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Delegation</div>
                        <div className="font-mono text-gray-400">{shorten(route.delegationId ?? route.correlationId)}</div>
                      </div>
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
