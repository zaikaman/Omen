import { useEffect, useMemo, useRef } from 'react';
import type { AgentEvent, AgentRole } from '@omen/shared';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileJson,
  GitBranch,
  Network,
  RadioTower,
  ServerCrash,
  ShieldCheck,
  Terminal,
  X,
  Zap,
} from 'lucide-react';

import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useLogs } from '../hooks/useLogs';
import { useTopology } from '../hooks/useTopology';
import { cn } from '../lib/utils';

type SwarmRunModalProps = {
  isOpen: boolean;
  onClose: () => void;
  runId: string | null;
  runMode?: string | null;
  runStatus?: string | null;
};

const REFRESH_INTERVAL_MS = 3_000;

const roleClassName: Partial<Record<AgentRole, string>> = {
  orchestrator: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
  market_bias: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  scanner: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  research: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200',
  chart_vision: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200',
  analyst: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  critic: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  intel: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  generator: 'border-lime-500/40 bg-lime-500/10 text-lime-200',
  writer: 'border-pink-500/40 bg-pink-500/10 text-pink-200',
  publisher: 'border-green-500/40 bg-green-500/10 text-green-200',
  memory: 'border-gray-500/40 bg-gray-500/10 text-gray-200',
  monitor: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
};

const statusClassName: Record<AgentEvent['status'], string> = {
  info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  success: 'border-green-500/40 bg-green-500/10 text-green-300',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  pending: 'border-gray-500/40 bg-gray-500/10 text-gray-300',
};

const formatLabel = (value: string | null | undefined, fallback = 'UNKNOWN') => {
  if (!value) {
    return fallback;
  }

  return value.replace(/_/g, ' ').toUpperCase();
};

const formatTime = (value: string | null | undefined) => {
  if (!value) {
    return '--:--:--';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
};

const shorten = (value: string | null | undefined, size = 18) => {
  if (!value) {
    return 'none';
  }

  return value.length > size ? `${value.slice(0, Math.max(size - 8, 6))}...${value.slice(-5)}` : value;
};

const getEventIcon = (event: AgentEvent) => {
  if (event.eventType.startsWith('zero_g')) {
    return Database;
  }

  if (event.eventType.startsWith('axl') || event.axlMessageId) {
    return RadioTower;
  }

  if (event.proofRefId) {
    return ShieldCheck;
  }

  if (event.status === 'error') {
    return ServerCrash;
  }

  if (event.status === 'success') {
    return CheckCircle2;
  }

  if (event.status === 'warning') {
    return AlertTriangle;
  }

  return Activity;
};

const getPayloadPreview = (payload: Record<string, unknown>) => {
  const entries = Object.entries(payload).filter(([, value]) => value !== null && value !== undefined);

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries.slice(0, 6));
};

export function SwarmRunModal({
  isOpen,
  onClose,
  runId,
  runMode,
  runStatus,
}: SwarmRunModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const logs = useLogs({
    enabled: isOpen && Boolean(runId),
    limit: 120,
    runId,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const topology = useTopology({
    enabled: isOpen,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });

  const events = useMemo(
    () => [...logs.logs].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    [logs.logs],
  );
  const latestEvent = events.at(-1) ?? null;
  const axlEvents = events.filter((event) => event.axlMessageId || event.eventType.startsWith('axl'));
  const zeroGEvents = events.filter((event) => event.proofRefId || event.eventType.startsWith('zero_g'));
  const successfulEvents = events.filter((event) => event.status === 'success').length;
  const failedEvents = events.filter((event) => event.status === 'error').length;
  const onlinePeers = topology.peers.filter((peer) => peer.status === 'online').length;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 18 }}
            transition={{ duration: 0.18 }}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-cyan-500/25 bg-black shadow-[0_0_42px_rgba(6,182,212,0.14)]"
          >
            <div className="flex flex-col gap-4 border-b border-cyan-500/20 bg-gray-950 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-cyan-300">
                  <Terminal className="h-4 w-4" />
                  <span className="font-mono text-sm font-bold tracking-wider">OMEN_SWARM // LIVE_RUN</span>
                  <Badge className="border-green-500/40 bg-green-500/10 text-green-300">
                    {formatLabel(runStatus, 'RUNNING')}
                  </Badge>
                </div>
                <div className="mt-2 truncate font-mono text-lg text-white">{shorten(runId, 42)}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Mode {formatLabel(runMode)}</span>
                  <span>Last event {formatTime(latestEvent?.timestamp)}</span>
                  <span>{logs.isRefreshing || topology.isRefreshing ? 'Syncing backend...' : 'Backend feed live'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="self-start rounded-lg border border-gray-800 bg-gray-950 p-2 text-gray-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
                aria-label="Close swarm run monitor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="relative min-h-0 border-b border-gray-800 bg-black lg:border-b-0 lg:border-r">
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.22)_50%),linear-gradient(90deg,rgba(6,182,212,0.05),rgba(168,85,247,0.035),rgba(16,185,129,0.04))] bg-[length:100%_2px,4px_100%]" />
                <ScrollArea className="h-[54vh] lg:h-[620px]">
                  <div ref={scrollRef} className="relative p-4 font-mono">
                    {logs.isLoading && events.length === 0 ? (
                      <div className="flex h-[440px] flex-col items-center justify-center gap-3 text-cyan-500/40">
                        <Cpu className="h-10 w-10 animate-pulse" />
                        <span className="text-xs tracking-wider">AWAITING RUN EVENTS...</span>
                      </div>
                    ) : logs.error && events.length === 0 ? (
                      <div className="flex h-[440px] flex-col items-center justify-center gap-3 text-red-300">
                        <ServerCrash className="h-10 w-10" />
                        <span className="text-sm">Unable to load active run logs.</span>
                      </div>
                    ) : events.length === 0 ? (
                      <div className="flex h-[440px] flex-col items-center justify-center gap-3 text-gray-500">
                        <Terminal className="h-10 w-10" />
                        <span className="text-xs tracking-wider">RUN CLAIMED, WAITING FOR FIRST AGENT EVENT...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {events.map((event) => {
                          const Icon = getEventIcon(event);
                          const payloadPreview = getPayloadPreview(event.payload);

                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="rounded-lg border border-gray-800 bg-gray-950/70 p-3"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] text-gray-500">{formatTime(event.timestamp)}</span>
                                    <Badge className={cn('uppercase', roleClassName[event.agentRole] ?? 'border-gray-700 bg-gray-900 text-gray-300')}>
                                      {formatLabel(event.agentRole)}
                                    </Badge>
                                    <Badge className={cn('uppercase', statusClassName[event.status])}>{event.status}</Badge>
                                    <span className="text-[11px] uppercase tracking-wider text-gray-500">{formatLabel(event.eventType)}</span>
                                  </div>
                                  <div className="mt-2 flex gap-2 text-sm leading-relaxed text-gray-200">
                                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                    <span>{event.summary}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 grid gap-2 border-t border-gray-800 pt-3 text-[11px] sm:grid-cols-3">
                                <div>
                                  <div className="text-gray-600">AXL message</div>
                                  <div className="truncate text-cyan-300">{shorten(event.axlMessageId)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">0G proof ref</div>
                                  <div className="truncate text-emerald-300">{shorten(event.proofRefId)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Correlation</div>
                                  <div className="truncate text-purple-300">{shorten(event.correlationId)}</div>
                                </div>
                              </div>
                              {payloadPreview && (
                                <pre className="mt-3 max-h-28 overflow-auto rounded border border-cyan-500/10 bg-black/60 p-2 text-[10px] leading-relaxed text-cyan-100/70">
                                  {JSON.stringify(payloadPreview, null, 2)}
                                </pre>
                              )}
                            </motion.div>
                          );
                        })}
                        <div className="h-4 w-2 animate-pulse bg-cyan-500/60" />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <aside className="min-h-0 bg-gray-950/95 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-gray-800 bg-black/40 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />
                      Success
                    </div>
                    <div className="mt-2 font-mono text-lg text-white">{successfulEvents}</div>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-black/40 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
                      Errors
                    </div>
                    <div className="mt-2 font-mono text-lg text-white">{failedEvents}</div>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">
                      <RadioTower className="h-3.5 w-3.5" />
                      AXL events
                    </div>
                    <div className="mt-2 font-mono text-lg text-cyan-100">{axlEvents.length}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">
                      <Database className="h-3.5 w-3.5" />
                      0G refs
                    </div>
                    <div className="mt-2 font-mono text-lg text-emerald-100">{zeroGEvents.length}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-gray-800 bg-black/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <Network className="h-3.5 w-3.5 text-purple-300" />
                      AXL topology
                    </div>
                    <Badge className="border-purple-500/40 bg-purple-500/10 text-purple-200">
                      {onlinePeers}/{topology.peers.length} online
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {topology.peers.slice(0, 5).map((peer) => (
                      <div key={peer.peerId} className="rounded border border-gray-800 bg-gray-950/70 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs text-gray-200">{peer.peerId}</span>
                          <span
                            className={cn(
                              'shrink-0 text-[10px] uppercase',
                              peer.status === 'online' && 'text-green-300',
                              peer.status === 'degraded' && 'text-yellow-300',
                              peer.status === 'offline' && 'text-red-300',
                            )}
                          >
                            {peer.status}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          {formatLabel(peer.role)} / {peer.latencyMs ?? '--'}ms
                        </div>
                      </div>
                    ))}
                    {topology.peers.length === 0 && (
                      <div className="rounded border border-gray-800 bg-gray-950/70 p-3 text-xs text-gray-500">
                        No AXL peers registered yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-gray-800 bg-black/40 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                    Backend path
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    {[
                      { icon: GitBranch, label: 'Dispatch', value: 'AXL MCP / A2A' },
                      { icon: FileJson, label: 'State', value: '0G KV checkpoint' },
                      { icon: Database, label: 'Logs', value: '0G append refs' },
                      { icon: Zap, label: 'Compute', value: '0G proof jobs' },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded border border-gray-800 bg-gray-950/70 px-2 py-2">
                          <span className="flex items-center gap-2 text-gray-500">
                            <Icon className="h-3.5 w-3.5 text-cyan-300" />
                            {item.label}
                          </span>
                          <span className="text-right font-mono text-gray-300">{item.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-500/20 bg-gray-950 px-4 py-2 font-mono text-[10px] text-cyan-500/60">
              <span>EVENTS: {events.length}</span>
              <span>AXL ROUTES: {topology.routes.length}</span>
              <span>SERVICES: {topology.services.length}</span>
              <span className="animate-pulse">CONNECTED</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
