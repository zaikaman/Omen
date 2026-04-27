import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { AgentEvent, Intel, Signal } from '@omen/shared';
import { SignalCard } from '../components/SignalCard';
import { IntelCard } from '../components/IntelCard';
import { TerminalLog } from '../components/TerminalLog';
import { useIntelDetail } from '../hooks/useIntel';
import { useLogs } from '../hooks/useLogs';
import { useRunStatus } from '../hooks/useRunStatus';
import { useSignalDetail } from '../hooks/useSignals';
import type { IntelCardItem, LogEntry, SignalCardItem } from '../types/ui-models';

const REFRESH_INTERVAL_MS = 30_000;

const toSignalCardItem = (signal: Signal | null): SignalCardItem | null => {
    if (!signal) {
        return null;
    }

    const primaryTarget = signal.targetPrice ?? signal.targets[0]?.price;

    return {
        id: signal.id,
        created_at: signal.publishedAt ?? signal.updatedAt ?? signal.createdAt,
        content: {
            token: {
                symbol: signal.asset,
                name: signal.asset,
            },
            confidence: signal.confidence,
            analysis: signal.whyNow,
            entry_price: signal.entryPrice ?? signal.entryZone?.low,
            target_price: primaryTarget,
            stop_loss: signal.stopLoss ?? signal.invalidation?.low,
            status: signal.signalStatus ?? 'pending',
            pnl_percent: signal.pnlPercent ?? undefined,
            current_price: signal.currentPrice ?? undefined,
            direction: signal.direction,
            asset: signal.asset,
        },
    };
};

const toIntelCardItem = (intel: Intel | null): IntelCardItem | null => {
    if (!intel) {
        return null;
    }

    return {
        id: intel.id,
        type: intel.category === 'opportunity' ? 'deep_dive' : 'alpha_report',
        created_at: intel.publishedAt ?? intel.createdAt,
        content: {
            topic: intel.title,
            tweet_text: intel.summary,
            formatted_thread: intel.body,
            image_url: intel.imageUrl,
        },
    };
};

const toLogType = (event: AgentEvent): LogEntry['type'] => {
    if (event.signalId || event.eventType === 'report_published') {
        return 'signal';
    }

    if (event.intelId || event.eventType === 'intel_ready') {
        return 'intel';
    }

    return event.status === 'warning' || event.status === 'error' ? 'skip' : 'intel';
};

const toLogEntry = (event: AgentEvent): LogEntry => ({
    id: event.id,
    type: toLogType(event),
    created_at: event.timestamp,
    content: {
        ...event.payload,
        log_message: event.summary,
    },
});

const formatRunStatus = (status: string | undefined) => {
    if (!status) {
        return 'IDLE';
    }

    return status.replace(/_/g, ' ').toUpperCase();
};

const formatSchedulerState = (
    scheduler: ReturnType<typeof useRunStatus>['scheduler'],
) => {
    if (!scheduler?.enabled) {
        return 'DISABLED';
    }

    return scheduler.isRunning ? 'RUNNING' : 'STANDBY';
};

export function DashboardHome() {
    const runStatus = useRunStatus({ refreshIntervalMs: REFRESH_INTERVAL_MS });
    const latestSignalId = runStatus.dashboardSummary?.latestSignalId ?? null;
    const latestIntelId = runStatus.dashboardSummary?.latestIntelId ?? null;
    const latestRun = runStatus.activeRun ?? runStatus.latestRun;
    const signalDetail = useSignalDetail(latestSignalId, {
        enabled: Boolean(latestSignalId),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
    const intelDetail = useIntelDetail(latestIntelId, {
        enabled: Boolean(latestIntelId),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
    const logs = useLogs({
        limit: 25,
        runId: runStatus.activeRunId,
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });

    const latestSignal = toSignalCardItem(signalDetail.signal);
    const latestIntel = toIntelCardItem(intelDetail.intel);
    const logEntries = logs.logs.map(toLogEntry);
    const hasRunStatusError = runStatus.error !== null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <HugeiconsIcon icon={Home01Icon} className="w-6 h-6 text-cyan-500" />
                        Dashboard
                    </h2>
                    <p className="text-gray-400 mt-1">Overview of your agent status and latest intelligence.</p>
                </div>
                {(runStatus.isRefreshing || signalDetail.isRefreshing || intelDetail.isRefreshing || logs.isRefreshing) && (
                    <span className="text-xs text-gray-500">Syncing live data...</span>
                )}
            </div>

            {hasRunStatusError && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                    Live runtime status is unavailable. Seeded dashboard fallback data may be shown.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Intelligence</h3>
                            <Link to="/app/intel" className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1">
                                View Feed <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
                            </Link>
                        </div>
                        <IntelCard
                            intel={latestIntel}
                            isLoading={runStatus.isLoading || intelDetail.isLoading}
                            error={intelDetail.error}
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Signal</h3>
                            <Link to="/app/signals" className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1">
                                View All <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
                            </Link>
                        </div>
                        <SignalCard
                            signal={latestSignal}
                            isLoading={runStatus.isLoading || signalDetail.isLoading}
                            error={signalDetail.error}
                            isLatest={true}
                        />
                    </div>
                </div>

                <div className="lg:relative">
                    <div className="flex flex-col gap-6 lg:absolute lg:inset-0">
                        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 shrink-0">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">System Status</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Run Status</span>
                                    <span className="text-green-400 font-mono">{formatRunStatus(latestRun?.status)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Scheduler</span>
                                    <span className="text-cyan-400 font-mono">{formatSchedulerState(runStatus.scheduler)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Market Bias</span>
                                    <span className="text-gray-300 font-mono">{latestRun?.marketBias ?? 'UNKNOWN'}</span>
                                </div>
                            </div>
                        </div>

                        <TerminalLog
                            logs={logEntries}
                            isLoading={logs.isLoading}
                            error={logs.error}
                            className="flex-1 min-h-[300px] lg:min-h-0"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
