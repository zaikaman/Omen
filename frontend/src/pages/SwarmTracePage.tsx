import { useMemo, useState } from 'react';
import type { AgentEvent, AgentRole, ProofArtifact } from '@omen/shared';
import {
  Activity,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  FileJson,
  GitBranch,
  RadioTower,
  Route,
  ServerCrash,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';

import { PeerTopologyPanel } from '../components/network/PeerTopologyPanel';
import { RouteTimeline } from '../components/network/RouteTimeline';
import { ServiceRegistryPanel } from '../components/network/ServiceRegistryPanel';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { useLogs } from '../hooks/useLogs';
import { useProofDetail, useProofFeed } from '../hooks/useProofs';
import { useRunStatus } from '../hooks/useRunStatus';
import { useTopology } from '../hooks/useTopology';
import { cn } from '../lib/utils';

const REFRESH_INTERVAL_MS = 30_000;

const roleOrder: AgentRole[] = [
  'orchestrator',
  'market_bias',
  'scanner',
  'research',
  'chart_vision',
  'analyst',
  'critic',
  'intel',
  'generator',
  'writer',
  'publisher',
  'memory',
  'monitor',
];

const integrationSteps = [
  {
    label: 'AXL dispatch',
    description: 'Orchestrator delegates work to peer MCP services and A2A routes.',
    eventTypes: ['axl_message_sent', 'axl_message_received'],
    icon: RadioTower,
    className: 'text-cyan-300',
  },
  {
    label: 'Agent work',
    description: 'Scanner, research, analyst, critic, writer, and publisher produce run events.',
    eventTypes: [
      'market_bias_generated',
      'candidate_found',
      'research_completed',
      'chart_generated',
      'thesis_generated',
      'critic_decision',
      'intel_ready',
      'report_published',
      'post_queued',
    ],
    icon: BrainCircuit,
    className: 'text-purple-300',
  },
  {
    label: '0G storage',
    description: 'Mutable checkpoints, immutable logs, and files are written as durable refs.',
    eventTypes: ['zero_g_kv_write', 'zero_g_log_append', 'zero_g_file_published'],
    icon: Database,
    className: 'text-emerald-300',
  },
  {
    label: '0G compute',
    description: 'Adjudication and synthesis proofs are attached to the run manifest.',
    eventTypes: ['critic_decision', 'report_published'],
    icon: Zap,
    className: 'text-amber-300',
  },
];

const statusClassName: Record<AgentEvent['status'], string> = {
  info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  success: 'border-green-500/40 bg-green-500/10 text-green-300',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  pending: 'border-gray-500/40 bg-gray-500/10 text-gray-300',
};

const roleClassName: Partial<Record<AgentRole, string>> = {
  orchestrator: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
  scanner: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  research: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200',
  analyst: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  critic: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  intel: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  writer: 'border-pink-500/40 bg-pink-500/10 text-pink-200',
  publisher: 'border-green-500/40 bg-green-500/10 text-green-200',
};

const formatLabel = (value: string | null | undefined, defaultLabel = 'UNKNOWN') => {
  if (!value) {
    return defaultLabel;
  }

  return value.replace(/_/g, ' ').toUpperCase();
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

  if (event.eventType.startsWith('axl')) {
    return RadioTower;
  }

  if (event.proofRefId) {
    return ShieldCheck;
  }

  if (event.status === 'error') {
    return ServerCrash;
  }

  return Terminal;
};

const getStageState = (eventTypes: string[], events: AgentEvent[]) => {
  const matchingEvents = events.filter((event) => eventTypes.includes(event.eventType));

  if (matchingEvents.some((event) => event.status === 'error')) {
    return 'error';
  }

  if (matchingEvents.length > 0) {
    return 'complete';
  }

  return 'waiting';
};

const getRunDuration = (startedAt: string | null | undefined, completedAt: string | null | undefined) => {
  if (!startedAt) {
    return 'UNKNOWN';
  }

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};

const countArtifacts = (artifacts: ProofArtifact[], refTypes: ProofArtifact['refType'][]) =>
  artifacts.filter((artifact) => refTypes.includes(artifact.refType)).length;

const getRunField = (run: unknown, field: 'status' | 'startedAt' | 'completedAt' | 'mode') => {
  if (!run || typeof run !== 'object' || !(field in run)) {
    return undefined;
  }

  const value = (run as Record<string, unknown>)[field];

  return typeof value === 'string' ? value : undefined;
};

export function SwarmTracePage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const runStatus = useRunStatus({ refreshIntervalMs: REFRESH_INTERVAL_MS });
  const proofFeed = useProofFeed({ limit: 12, refreshIntervalMs: REFRESH_INTERVAL_MS });
  const topology = useTopology({ refreshIntervalMs: REFRESH_INTERVAL_MS });
  const activeRunId =
    selectedRunId ??
    runStatus.activeRunId ??
    proofFeed.proofs[0]?.runId ??
    runStatus.latestRun?.id ??
    null;
  const logs = useLogs({
    limit: 120,
    runId: activeRunId,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const proofDetail = useProofDetail(activeRunId, {
    enabled: Boolean(activeRunId),
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });

  const events = useMemo(
    () => [...logs.logs].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    [logs.logs],
  );
  const latestEvent = events.at(-1) ?? null;
  const selectedRun =
    proofDetail.run ??
    runStatus.activeRun ??
    runStatus.latestRun ??
    proofFeed.proofs.find((proof) => proof.runId === activeRunId) ??
    null;
  const roleCounts = useMemo(
    () =>
      events.reduce<Partial<Record<AgentRole, number>>>((counts, event) => {
        counts[event.agentRole] = (counts[event.agentRole] ?? 0) + 1;
        return counts;
      }, {}),
    [events],
  );
  const orderedRoles = roleOrder.filter((role) => roleCounts[role]);
  const axlEvents = events.filter((event) => event.axlMessageId || event.eventType.startsWith('axl'));
  const zeroGEvents = events.filter((event) => event.proofRefId || event.eventType.startsWith('zero_g'));
  const storageCount = countArtifacts(proofDetail.artifacts, ['kv_state', 'log_entry', 'log_bundle', 'file_artifact']);
  const computeCount = countArtifacts(proofDetail.artifacts, ['compute_job', 'compute_result']);
  const manifestCount = countArtifacts(proofDetail.artifacts, ['manifest']);
  const postCount = countArtifacts(proofDetail.artifacts, ['post_payload', 'post_result']);
  const isRefreshing =
    runStatus.isRefreshing ||
    proofFeed.isRefreshing ||
    proofDetail.isRefreshing ||
    logs.isRefreshing ||
    topology.isRefreshing;

  const overviewItems = [
    {
      label: 'Run status',
      value: formatLabel(getRunField(selectedRun, 'status'), 'NO RUN'),
      icon: Activity,
      className: 'text-green-300',
    },
    {
      label: 'Agent events',
      value: events.length.toString(),
      icon: Terminal,
      className: 'text-cyan-300',
    },
    {
      label: 'AXL receipts',
      value: `${axlEvents.length}/${topology.routes.length}`,
      icon: Route,
      className: 'text-purple-300',
    },
    {
      label: '0G refs',
      value: `${zeroGEvents.length}/${proofDetail.artifacts.length}`,
      icon: Database,
      className: 'text-emerald-300',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            Swarm Trace
          </h2>
          <p className="mt-1 max-w-3xl text-gray-400">
            Live run telemetry across agents, AXL routing, and 0G storage, compute, and manifest refs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRefreshing && <span className="text-xs text-gray-500">Syncing swarm trace...</span>}
          <Badge className="border-cyan-500/40 bg-cyan-500/10 font-mono text-cyan-300">
            {shorten(activeRunId, 28)}
          </Badge>
        </div>
      </div>

      {(runStatus.error || logs.error || proofDetail.error || topology.error) && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Some live telemetry is unavailable.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {overviewItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="border-gray-800 bg-gray-900/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{item.label}</div>
                    <div className="mt-2 font-mono text-xl text-white">{item.value}</div>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
                    <Icon className={cn('h-5 w-5', item.className)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                <Clock3 className="h-4 w-4 text-cyan-300" />
                Runs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {proofFeed.isLoading && proofFeed.proofs.length === 0 ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
                ))
              ) : proofFeed.proofs.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">
                  No run manifests are available yet.
                </div>
              ) : (
                proofFeed.proofs.map((proof) => {
                  const isActive = proof.runId === activeRunId;

                  return (
                    <button
                      key={proof.runId}
                      type="button"
                      onClick={() => setSelectedRunId(proof.runId)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        isActive
                          ? 'border-cyan-500/40 bg-cyan-500/10'
                          : 'border-gray-800 bg-gray-950/40 hover:border-gray-700 hover:bg-gray-900/60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-white">{shorten(proof.runId, 24)}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatDateTime(proof.createdAt)}</div>
                        </div>
                        <Badge className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                          {proof.artifactCount} refs
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-800 pt-3 text-xs">
                        <div>
                          <div className="text-gray-600">Signal</div>
                          <div className="truncate font-mono text-gray-400">{shorten(proof.finalSignalId, 16)}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Intel</div>
                          <div className="truncate font-mono text-gray-400">{shorten(proof.finalIntelId, 16)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                <Boxes className="h-4 w-4 text-purple-300" />
                Agent lanes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {orderedRoles.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">
                  Agent lanes appear after run events load.
                </div>
              ) : (
                orderedRoles.map((role) => (
                  <div key={role} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={cn('uppercase', roleClassName[role] ?? 'border-gray-700 bg-gray-900 text-gray-300')}>
                        {formatLabel(role)}
                      </Badge>
                      <span className="font-mono text-sm text-white">{roleCounts[role]}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${Math.max(8, ((roleCounts[role] ?? 0) / Math.max(events.length, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className="overflow-hidden border-gray-800 bg-gray-900/40">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 bg-gray-950/50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <CheckCircle2 className="h-4 w-4 text-green-300" />
                      <span>{latestEvent ? latestEvent.summary : 'Waiting for run telemetry'}</span>
                    </div>
                    <div className="mt-2 truncate font-mono text-lg text-white">{shorten(activeRunId, 40)}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      {getRunField(selectedRun, 'startedAt') && <span>Started {formatDateTime(getRunField(selectedRun, 'startedAt'))}</span>}
                      {getRunField(selectedRun, 'startedAt') && (
                        <span>
                          Duration {getRunDuration(getRunField(selectedRun, 'startedAt'), getRunField(selectedRun, 'completedAt'))}
                        </span>
                      )}
                      {getRunField(selectedRun, 'mode') && <span>Mode {formatLabel(getRunField(selectedRun, 'mode'))}</span>}
                    </div>
                  </div>
                  <Badge className="w-fit border-gray-700 bg-gray-950/60 font-mono text-gray-300">
                    {formatDateTime(latestEvent?.timestamp)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 border-b border-gray-800 lg:grid-cols-4">
                {integrationSteps.map((step) => {
                  const Icon = step.icon;
                  const state = getStageState(step.eventTypes, events);

                  return (
                    <div key={step.label} className="border-b border-gray-800 p-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'rounded-lg border bg-gray-950/70 p-2',
                            state === 'complete' && 'border-green-500/40',
                            state === 'error' && 'border-red-500/40',
                            state === 'waiting' && 'border-gray-800',
                          )}
                        >
                          <Icon className={cn('h-5 w-5', step.className)} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{step.label}</span>
                            <Circle
                              className={cn(
                                'h-2.5 w-2.5',
                                state === 'complete' && 'fill-green-400 text-green-400',
                                state === 'error' && 'fill-red-400 text-red-400',
                                state === 'waiting' && 'fill-gray-600 text-gray-600',
                              )}
                            />
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <FileJson className="h-3.5 w-3.5 text-cyan-300" />
                    Storage
                  </div>
                  <div className="mt-2 font-mono text-sm text-white">{storageCount} refs</div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <Zap className="h-3.5 w-3.5 text-amber-300" />
                    Compute
                  </div>
                  <div className="mt-2 font-mono text-sm text-white">{computeCount} proofs</div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                    Manifest
                  </div>
                  <div className="mt-2 font-mono text-sm text-white">{manifestCount ? 'ready' : 'pending'}</div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <GitBranch className="h-3.5 w-3.5 text-purple-300" />
                    Published
                  </div>
                  <div className="mt-2 font-mono text-sm text-white">{postCount} refs</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                      <Terminal className="h-4 w-4 text-cyan-300" />
                      Backend event stream
                    </CardTitle>
                    <p className="mt-1 text-xs text-gray-500">Agent events, proof refs, correlation IDs, and transport receipts.</p>
                  </div>
                  <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
                    {events.length} EVENTS
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {logs.isLoading && events.length === 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
                    ))}
                  </div>
                ) : logs.error && events.length === 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
                    <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
                    <p className="text-sm text-red-200">Unable to load backend events.</p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
                    <Terminal className="mb-3 h-8 w-8 text-gray-600" />
                    <p className="text-sm text-gray-500">No events recorded for this run yet.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[640px] pr-3">
                    <div className="relative space-y-3 pl-5">
                      <div className="absolute bottom-3 left-1.5 top-3 w-px bg-gray-800" />
                      {events.map((event) => {
                        const Icon = getEventIcon(event);

                        return (
                          <div key={event.id} className="relative rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                            <div className="absolute -left-[19px] top-4 rounded-full border border-gray-700 bg-gray-950 p-1">
                              <Icon className="h-2.5 w-2.5 text-cyan-300" />
                            </div>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={cn('uppercase', roleClassName[event.agentRole] ?? 'border-gray-700 bg-gray-900 text-gray-300')}>
                                    {formatLabel(event.agentRole)}
                                  </Badge>
                                  <Badge className={cn('uppercase', statusClassName[event.status])}>{event.status}</Badge>
                                  <span className="font-mono text-xs uppercase text-gray-500">{formatLabel(event.eventType)}</span>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-gray-200">{event.summary}</p>
                              </div>
                              <span className="shrink-0 font-mono text-xs text-gray-500">{formatDateTime(event.timestamp)}</span>
                            </div>
                            <div className="mt-3 grid gap-2 border-t border-gray-800 pt-3 text-xs md:grid-cols-4">
                              <div>
                                <div className="text-gray-600">Agent</div>
                                <div className="truncate font-mono text-gray-400">{shorten(event.agentId, 18)}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">AXL</div>
                                <div className="truncate font-mono text-cyan-300">{shorten(event.axlMessageId, 18)}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">0G proof</div>
                                <div className="truncate font-mono text-emerald-300">{shorten(event.proofRefId, 18)}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Correlation</div>
                                <div className="truncate font-mono text-purple-300">{shorten(event.correlationId, 18)}</div>
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

            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                  <Database className="h-4 w-4 text-emerald-300" />
                  0G artifact trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proofDetail.isLoading && proofDetail.artifacts.length === 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: 7 }).map((_, index) => (
                      <div key={index} className="h-14 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
                    ))}
                  </div>
                ) : proofDetail.artifacts.length === 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
                    <Database className="mb-3 h-8 w-8 text-gray-600" />
                    <p className="text-sm text-gray-500">No 0G refs for this run yet.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[640px] pr-3">
                    <div className="space-y-2">
                      {proofDetail.artifacts.map((artifact) => (
                        <div key={artifact.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Badge className="border-emerald-500/40 bg-emerald-500/10 uppercase text-emerald-300">
                                {formatLabel(artifact.refType)}
                              </Badge>
                              <div className="mt-2 truncate font-mono text-sm text-white">{artifact.key ?? artifact.id}</div>
                            </div>
                            {artifact.compute && <Zap className="h-4 w-4 shrink-0 text-amber-300" />}
                          </div>
                          <div className="mt-3 truncate rounded border border-gray-800 bg-black/30 px-2 py-1 font-mono text-xs text-gray-400">
                            {artifact.locator}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-800 pt-2 text-xs">
                            <span className="text-gray-600">Created</span>
                            <span className="font-mono text-gray-400">{formatDateTime(artifact.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <PeerTopologyPanel
              nodes={topology.nodes}
              peers={topology.peers}
              capturedAt={topology.capturedAt}
              isLoading={topology.isLoading}
              error={topology.error}
            />
            <ServiceRegistryPanel
              services={topology.services}
              capturedAt={topology.capturedAt}
              isLoading={topology.isLoading}
              error={topology.error}
            />
          </div>

          <RouteTimeline routes={topology.routes} isLoading={topology.isLoading} error={topology.error} />
        </div>
      </div>
    </div>
  );
}
