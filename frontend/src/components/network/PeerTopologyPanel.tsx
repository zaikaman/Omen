import type { AgentNode, AxlPeerStatus } from '@omen/shared';
import { Activity, Circle, Network, RadioTower, ServerCrash } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

type PeerTopologyPanelProps = {
  nodes?: AgentNode[];
  peers?: AxlPeerStatus[];
  capturedAt?: string | null;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

const statusClassName: Record<AxlPeerStatus['status'], string> = {
  online: 'border-green-500/40 bg-green-500/10 text-green-300',
  degraded: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  offline: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const dotClassName: Record<AxlPeerStatus['status'], string> = {
  online: 'fill-green-400 text-green-400',
  degraded: 'fill-yellow-300 text-yellow-300',
  offline: 'fill-red-400 text-red-400',
};

const formatRole = (role: string) => role.replace(/_/g, ' ').toUpperCase();

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'NO HEARTBEAT';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getPeerNodeId = (peer: AxlPeerStatus, nodes: AgentNode[]) =>
  nodes.find((node) => node.peerId === peer.peerId)?.id ?? peer.peerId;

export function PeerTopologyPanel({
  nodes = [],
  peers = [],
  capturedAt,
  isLoading,
  error,
  className,
}: PeerTopologyPanelProps) {
  const onlinePeers = peers.filter((peer) => peer.status === 'online').length;
  const axlNodes = nodes.filter((node) => node.transport === 'axl').length;

  if (isLoading && peers.length === 0) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <Network className="h-4 w-4 text-cyan-400" />
            AXL Peer Graph
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
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
              <Network className="h-4 w-4 text-cyan-400" />
              AXL Peer Graph
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {error ? 'Topology unavailable' : `Snapshot ${formatDateTime(capturedAt)}`}
            </p>
          </div>
          <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            {onlinePeers}/{peers.length} ONLINE
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && peers.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load AXL topology.</p>
          </div>
        ) : peers.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <RadioTower className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">No AXL peers registered.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Peers</div>
                <div className="mt-1 font-mono text-xl text-white">{peers.length}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">AXL Nodes</div>
                <div className="mt-1 font-mono text-xl text-cyan-300">{axlNodes}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Services</div>
                <div className="mt-1 font-mono text-xl text-purple-300">
                  {peers.reduce((total, peer) => total + peer.services.length, 0)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Latency</div>
                <div className="mt-1 font-mono text-xl text-gray-200">
                  {Math.round(
                    peers.reduce((total, peer) => total + (peer.latencyMs ?? 0), 0) /
                      Math.max(peers.filter((peer) => peer.latencyMs !== null).length, 1),
                  )}
                  ms
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {peers.map((peer) => (
                <div key={peer.peerId} className="relative rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <div className="absolute left-0 top-4 h-px w-4 bg-cyan-500/40" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Circle className={cn('h-2.5 w-2.5 shrink-0', dotClassName[peer.status])} />
                        <span className="truncate font-mono text-sm text-white">{getPeerNodeId(peer, nodes)}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">{formatRole(peer.role)}</div>
                    </div>
                    <Badge className={cn('shrink-0 uppercase', statusClassName[peer.status])}>{peer.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {peer.services.length > 0 ? (
                      peer.services.slice(0, 4).map((service) => (
                        <span key={service} className="rounded border border-gray-800 bg-gray-900 px-2 py-1 text-[10px] text-gray-300">
                          {service}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-600">No services advertised</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3 text-xs">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Activity className="h-3 w-3" />
                      Last seen
                    </span>
                    <span className="font-mono text-gray-400">{formatDateTime(peer.lastSeenAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
