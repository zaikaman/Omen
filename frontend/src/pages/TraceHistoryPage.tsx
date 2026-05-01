import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AgentEvent, RunListItem } from '@omen/shared';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiBrain03Icon } from '@hugeicons/core-free-icons';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpenText,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  MessageSquareText,
  RadioTower,
  Search,
  ServerCrash,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useLogs } from '../hooks/useLogs';
import { useRuns } from '../hooks/useRuns';
import { cn } from '../lib/utils';

const REFRESH_INTERVAL_MS = 30_000;
const RUN_LIMIT = 40;

type TraceItem = {
  label: string;
  value: string;
};

type EvidenceTrailItem = {
  category: string;
  summary: string;
  sourceLabel: string;
};

type CandidateTrailItem = {
  symbol: string;
  status: string;
  directionHint: string | null;
  reason: string;
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

const formatDuration = (run: RunListItem) => {
  if (!run.startedAt) {
    return 'not started';
  }

  const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(run.startedAt).getTime()) / 1000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const shorten = (value: string | null | undefined, size = 24) => {
  if (!value) {
    return 'none';
  }

  return value.length > size ? `${value.slice(0, Math.max(size - 8, 6))}...${value.slice(-5)}` : value;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }

  return null;
};

const getTraceItems = (payload: Record<string, unknown>): TraceItem[] => {
  const rawTrace = Array.isArray(payload.reasoningTrace) ? payload.reasoningTrace : [];
  const traceItems = rawTrace
    .map((item) => {
      const record = asRecord(item);
      const label = asString(record.label);
      const value = asString(record.value);

      return label && value ? { label, value } : null;
    })
    .filter((item): item is TraceItem => item !== null);

  const directItems: TraceItem[] = [
    ['reasoning', 'Reasoning'],
    ['whyNow', 'Why now'],
    ['uncertaintyNotes', 'Uncertainty'],
    ['summary', 'Summary'],
  ]
    .map(([key, label]) => {
      const value = asString(payload[key]);
      return value ? { label, value } : null;
    })
    .filter((item): item is TraceItem => item !== null);

  return [...traceItems, ...directItems].slice(0, 8);
};

const getEvidenceTrail = (payload: Record<string, unknown>): EvidenceTrailItem[] =>
  (Array.isArray(payload.evidenceTrail) ? payload.evidenceTrail : [])
    .map((item) => {
      const record = asRecord(item);
      const category = asString(record.category);
      const summary = asString(record.summary);
      const sourceLabel = asString(record.sourceLabel);

      return category && summary && sourceLabel ? { category, summary, sourceLabel } : null;
    })
    .filter((item): item is EvidenceTrailItem => item !== null);

const getCandidateTrail = (payload: Record<string, unknown>): CandidateTrailItem[] =>
  (Array.isArray(payload.candidates) ? payload.candidates : [])
    .map((item) => {
      const record = asRecord(item);
      const symbol = asString(record.symbol);
      const status = asString(record.status);
      const reason = asString(record.reason);

      return symbol && status && reason
        ? {
            symbol,
            status,
            directionHint: asString(record.directionHint),
            reason,
          }
        : null;
    })
    .filter((item): item is CandidateTrailItem => item !== null);

const getTraceEvents = (events: AgentEvent[]) =>
  events.filter((event) => {
    const payload = event.payload;
    return (
      getTraceItems(payload).length > 0 ||
      getEvidenceTrail(payload).length > 0 ||
      getCandidateTrail(payload).length > 0 ||
      event.axlMessageId ||
      event.proofRefId
    );
  });

const getRunOutputLabel = (run: RunListItem) => {
  if (run.outcome?.outcomeType === 'signal') {
    return 'signal';
  }

  if (run.outcome?.outcomeType === 'intel') {
    return 'intel';
  }

  return run.outcome?.outcomeType ?? 'no output';
};

const getEventIcon = (event: AgentEvent) => {
  if (event.proofRefId || event.eventType.startsWith('zero_g')) {
    return Database;
  }

  if (event.axlMessageId || event.eventType.startsWith('axl')) {
    return RadioTower;
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

export function TraceHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryRunId = searchParams.get('runId');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(queryRunId);
  const [query, setQuery] = useState('');
  const runs = useRuns({
    limit: RUN_LIMIT,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const outputRuns = useMemo(
    () =>
      runs.runs.filter(
        (run) =>
          run.finalSignalId ||
          run.finalIntelId ||
          run.outcome?.outcomeType === 'signal' ||
          run.outcome?.outcomeType === 'intel',
      ),
    [runs.runs],
  );
  const activeRunId = selectedRunId ?? queryRunId ?? outputRuns[0]?.id ?? null;
  const logs = useLogs({
    enabled: Boolean(activeRunId),
    limit: 160,
    runId: activeRunId,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });

  useEffect(() => {
    if (queryRunId) {
      setSelectedRunId(queryRunId);
    }
  }, [queryRunId]);

  useEffect(() => {
    if (!selectedRunId && outputRuns[0]?.id) {
      setSelectedRunId(outputRuns[0].id);
    }
  }, [outputRuns, selectedRunId]);

  const activeRun = runs.runs.find((run) => run.id === activeRunId) ?? null;
  const events = useMemo(
    () => [...logs.logs].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    [logs.logs],
  );
  const traceEvents = useMemo(() => getTraceEvents(events), [events]);
  const filteredTraceEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return traceEvents;
    }

    return traceEvents.filter((event) => {
      const traceText = getTraceItems(event.payload)
        .map((item) => `${item.label} ${item.value}`)
        .join(' ');
      const evidenceText = getEvidenceTrail(event.payload)
        .map((item) => `${item.category} ${item.summary} ${item.sourceLabel}`)
        .join(' ');
      const candidateText = getCandidateTrail(event.payload)
        .map((item) => `${item.symbol} ${item.status} ${item.reason}`)
        .join(' ');

      return [
        event.summary,
        event.agentRole,
        event.eventType,
        event.status,
        event.axlMessageId,
        event.proofRefId,
        traceText,
        evidenceText,
        candidateText,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [query, traceEvents]);

  const axlEvents = events.filter((event) => event.axlMessageId || event.eventType.startsWith('axl')).length;
  const proofEvents = events.filter((event) => event.proofRefId || event.eventType.startsWith('zero_g')).length;
  const reasoningEvents = events.filter((event) => getTraceItems(event.payload).length > 0).length;
  const isRefreshing = runs.isRefreshing || logs.isRefreshing;

  const selectRun = (runId: string) => {
    setSelectedRunId(runId);
    setSearchParams({ runId });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <HugeiconsIcon icon={AiBrain03Icon} className="h-6 w-6 text-cyan-500" />
            Agent Trace History
          </h2>
          <p className="mt-1 max-w-3xl text-gray-400">
            Inspect the recorded reasoning checkpoints, candidate reviews, AXL route IDs, and 0G proof refs behind each signal or intel run.
          </p>
        </div>
        {isRefreshing && <span className="text-xs text-gray-500">Syncing trace records...</span>}
      </div>

      {(runs.error || logs.error) && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          {runs.error ? 'Run history is unavailable.' : 'Trace events are unavailable for the selected run.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                <Terminal className="h-4 w-4 text-cyan-300" />
                Runs with outputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.isLoading && runs.runs.length === 0 ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
                ))
              ) : outputRuns.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">
                  No signal or intel producing swarm runs are available yet.
                </div>
              ) : (
                outputRuns.map((run) => {
                  const isActive = activeRunId === run.id;
                  const outputLabel = getRunOutputLabel(run);

                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => selectRun(run.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        isActive
                          ? 'border-cyan-500/40 bg-cyan-500/10'
                          : 'border-gray-800 bg-gray-950/40 hover:border-gray-700 hover:bg-gray-900/60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-white">{shorten(run.id, 30)}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatDateTime(run.startedAt)}</div>
                        </div>
                        <Badge
                          className={cn(
                            'uppercase',
                            run.status === 'completed'
                              ? 'border-green-500/40 bg-green-500/10 text-green-300'
                              : run.status === 'failed'
                                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                                : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
                          )}
                        >
                          {formatLabel(run.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-800 pt-3 text-xs">
                        <div>
                          <div className="text-gray-600">Output</div>
                          <div className="truncate font-mono text-gray-300">{formatLabel(outputLabel)}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Mode</div>
                          <div className="truncate font-mono text-gray-300">{formatLabel(run.mode)}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Duration</div>
                          <div className="truncate font-mono text-gray-300">{formatDuration(run)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardContent className="p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <Sparkles className="h-4 w-4 text-cyan-300" />
                      <span>{activeRun ? 'Run trace loaded' : 'Select a run'}</span>
                      {activeRun?.outcome && (
                        <Badge className="border-purple-500/40 bg-purple-500/10 text-purple-200">
                          {formatLabel(activeRun.outcome.outcomeType)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 truncate font-mono text-lg text-white">{shorten(activeRunId, 56)}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Started {formatDateTime(activeRun?.startedAt)}</span>
                      <span>Completed {formatDateTime(activeRun?.completedAt)}</span>
                      <span>Market bias {formatLabel(activeRun?.marketBias)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeRun?.finalSignalId && (
                      <Link
                        to="/app/signals"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-cyan-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                      >
                        Signal
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    )}
                    {activeRun?.finalIntelId && (
                      <Link
                        to={`/app/intel/${activeRun.finalIntelId}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-cyan-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                      >
                        Intel
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    )}
                    {activeRunId && (
                      <Link
                        to={`/app/evidence?runId=${encodeURIComponent(activeRunId)}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-cyan-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                      >
                        Proofs
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: 'Events', value: events.length, icon: Activity, className: 'text-cyan-300' },
                    { label: 'Reasoning', value: reasoningEvents, icon: MessageSquareText, className: 'text-purple-300' },
                    { label: 'AXL IDs', value: axlEvents, icon: RadioTower, className: 'text-cyan-300' },
                    { label: '0G refs', value: proofEvents, icon: ShieldCheck, className: 'text-green-300' },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          <Icon className={cn('h-3.5 w-3.5', item.className)} />
                          {item.label}
                        </div>
                        <div className="mt-2 font-mono text-lg text-white">{item.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-3 sm:flex-row sm:items-center">
            <div className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border border-gray-800 bg-black/40 px-3">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search agent, evidence, candidate, proof ref..."
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-600"
              />
            </div>
            <Badge className="w-fit border-gray-700 bg-gray-950/60 text-gray-300">
              {filteredTraceEvents.length} trace checkpoints
            </Badge>
          </div>

          <div className="space-y-3">
            {logs.isLoading && events.length === 0 ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
              ))
            ) : filteredTraceEvents.length === 0 ? (
              <Card className="border-gray-800 bg-gray-900/40">
                <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
                  <MessageSquareText className="mb-3 h-8 w-8 text-gray-600" />
                  <div className="text-sm font-semibold text-gray-300">No trace checkpoints found</div>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                    {query
                      ? 'No recorded agent trace matches the current search.'
                      : 'This run has no structured reasoning, evidence, AXL, or 0G trace events recorded.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredTraceEvents.map((event) => {
                const Icon = getEventIcon(event);
                const traceItems = getTraceItems(event.payload);
                const evidenceTrail = getEvidenceTrail(event.payload);
                const candidateTrail = getCandidateTrail(event.payload);

                return (
                  <div key={event.id} className="rounded-lg border border-gray-800 bg-gray-950/55 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-gray-500">{formatDateTime(event.timestamp)}</span>
                          <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                            {formatLabel(event.agentRole)}
                          </Badge>
                          <Badge className={cn('uppercase', statusClassName[event.status])}>{event.status}</Badge>
                          <span className="font-mono text-[11px] uppercase tracking-wider text-gray-500">
                            {formatLabel(event.eventType)}
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2 text-sm leading-relaxed text-gray-200">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                          <span>{event.summary}</span>
                        </div>
                      </div>
                    </div>

                    {(traceItems.length > 0 || evidenceTrail.length > 0 || candidateTrail.length > 0) && (
                      <div className="mt-4 grid gap-3 border-t border-gray-800 pt-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300/75">
                            <MessageSquareText className="h-3.5 w-3.5" />
                            Reasoning checkpoints
                          </div>
                          {traceItems.length > 0 ? (
                            traceItems.map((item) => (
                              <div key={`${event.id}-${item.label}`} className="rounded border border-cyan-500/10 bg-black/35 p-2">
                                <div className="text-[10px] uppercase tracking-wider text-cyan-300/70">{item.label}</div>
                                <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-200">{item.value}</div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded border border-gray-800 bg-black/30 p-2 text-xs text-gray-500">
                              No structured reasoning was emitted at this checkpoint.
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300/75">
                            <BookOpenText className="h-3.5 w-3.5" />
                            Evidence and candidates
                          </div>
                          {candidateTrail.map((candidate) => (
                            <div key={`${event.id}-${candidate.symbol}`} className="rounded border border-blue-500/10 bg-black/35 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs text-blue-200">{candidate.symbol}</span>
                                <span className="text-[10px] uppercase text-gray-500">{candidate.directionHint ?? candidate.status}</span>
                              </div>
                              <div className="mt-1 text-xs leading-relaxed text-gray-300">{candidate.reason}</div>
                            </div>
                          ))}
                          {evidenceTrail.map((item, index) => (
                            <div key={`${event.id}-${item.sourceLabel}-${index}`} className="rounded border border-emerald-500/10 bg-black/35 p-2">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                                <span className="text-emerald-300">{formatLabel(item.category)}</span>
                                <span className="text-gray-600">{item.sourceLabel}</span>
                              </div>
                              <div className="mt-1 text-xs leading-relaxed text-gray-300">{item.summary}</div>
                            </div>
                          ))}
                          {candidateTrail.length === 0 && evidenceTrail.length === 0 && (
                            <div className="rounded border border-gray-800 bg-black/30 p-2 text-xs text-gray-500">
                              No candidate or evidence payload was emitted at this checkpoint.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid gap-2 border-t border-gray-800 pt-3 text-[11px] sm:grid-cols-3">
                      <div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <GitBranch className="h-3 w-3" />
                          AXL message
                        </div>
                        <div className="truncate font-mono text-cyan-300">{shorten(event.axlMessageId)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Database className="h-3 w-3" />
                          0G proof ref
                        </div>
                        <div className="truncate font-mono text-emerald-300">{shorten(event.proofRefId)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <FileText className="h-3 w-3" />
                          Correlation
                        </div>
                        <div className="truncate font-mono text-purple-300">{shorten(event.correlationId)}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
