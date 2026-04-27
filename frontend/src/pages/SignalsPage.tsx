import { useState, useMemo, useEffect } from 'react';
import { SignalCard } from '../components/SignalCard';
import { SponsorProofSummary } from '../components/proofs/SponsorProofSummary';
import { SearchAndSort } from '../components/ui/SearchAndSort';
import type { SortOption, FilterConfig } from '../components/ui/SearchAndSort';
import { HugeiconsIcon } from '@hugeicons/react';
import { GpsSignal01Icon, Loading03Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { SignalListItem } from '@omen/shared';
import { useProofDetail } from '../hooks/useProofs';
import { usePosts } from '../hooks/usePosts';
import { useSignalDetail, useSignals } from '../hooks/useSignals';
import type { SignalCardItem } from '../types/ui-models';

const ITEMS_PER_PAGE = 10;

const SORT_OPTIONS: SortOption[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'confidence-high', label: 'Confidence (High)' },
    { value: 'confidence-low', label: 'Confidence (Low)' },
    { value: 'pnl-high', label: 'P&L (High)' },
    { value: 'pnl-low', label: 'P&L (Low)' },
];

const FILTER_CONFIG: FilterConfig[] = [
    {
        key: 'status',
        label: 'Status',
        options: [
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'tp_hit', label: 'TP Hit' },
            { value: 'sl_hit', label: 'SL Hit' },
            { value: 'closed', label: 'Closed' },
        ],
    },
    {
        key: 'direction',
        label: 'Direction',
        options: [
            { value: 'all', label: 'All' },
            { value: 'long', label: 'Long' },
            { value: 'short', label: 'Short' },
        ],
    },
];

const REFRESH_INTERVAL_MS = 30_000;

const toSignalCardItem = (signal: SignalListItem): SignalCardItem => {
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

const postStatusClassName = (status: string | undefined) => {
    switch (status) {
        case 'posted':
            return 'border-green-500/30 bg-green-500/10 text-green-200';
        case 'failed':
            return 'border-red-500/30 bg-red-500/10 text-red-200';
        case 'queued':
        case 'formatting':
        case 'ready':
        case 'posting':
            return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100';
        default:
            return 'border-gray-700 bg-gray-900/50 text-gray-400';
    }
};

export function SignalsPage() {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [filters, setFilters] = useState<Record<string, string>>({
        status: 'all',
        direction: 'all',
    });

    useEffect(() => {
        setPage(1);
    }, [searchQuery, sortBy, filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const latestQuery = useSignals({
        limit: 1,
        sort: 'newest',
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
    const historyQuery = useSignals({
        direction: filters.direction,
        limit: ITEMS_PER_PAGE,
        page,
        query: searchQuery.trim(),
        sort: sortBy,
        status: filters.status,
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });

    const latestRawSignal = latestQuery.signals[0] ?? null;
    const latestSignalDetail = useSignalDetail(latestRawSignal?.id, {
        enabled: Boolean(latestRawSignal?.id),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
    const latestPostQuery = usePosts({
        signalId: latestRawSignal?.id,
        enabled: Boolean(latestRawSignal?.id),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
    const proofRunId = latestSignalDetail.signal?.runId ?? latestRawSignal?.runId ?? null;
    const proofDetail = useProofDetail(proofRunId, {
        enabled: Boolean(proofRunId),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });

    const latestSignal = latestRawSignal
        ? toSignalCardItem(latestRawSignal)
        : null;
    const displaySignals = useMemo(
        () => historyQuery.signals.map(toSignalCardItem),
        [historyQuery.signals],
    );
    const totalPages = Math.max(1, Math.ceil(historyQuery.total / ITEMS_PER_PAGE));
    const isStatusLoading = latestQuery.isLoading;
    const isHistoryLoading = historyQuery.isLoading;
    const isHistoryRefreshing = historyQuery.isRefreshing;

    const handlePrevPage = () => {
        if (page > 1) setPage((p) => p - 1);
    };

    const handleNextPage = () => {
        if (page < totalPages) setPage((p) => p + 1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <HugeiconsIcon icon={GpsSignal01Icon} className="w-6 h-6 text-cyan-500" />
                        Signals
                    </h2>
                    <p className="text-gray-400 mt-1">Real-time alpha signals generated by the swarm.</p>
                </div>
                {(latestQuery.isRefreshing || latestSignalDetail.isRefreshing || latestPostQuery.isRefreshing || isHistoryRefreshing || proofDetail.isRefreshing) && (
                    <span className="text-xs text-gray-500">Syncing live data...</span>
                )}
            </div>

            {(latestQuery.error || historyQuery.error) && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                    Live signal history is unavailable. Seeded fallback data may be shown.
                </div>
            )}

            {/* Latest Signal - Always Visible */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Signal</h3>
                <SignalCard signal={latestSignal} isLoading={isStatusLoading} isLatest={true} />
                {latestPostQuery.latestPost && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${postStatusClassName(latestPostQuery.latestPost.status)}`}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-mono uppercase">
                                X delivery: {latestPostQuery.latestPost.status.replace(/_/g, ' ')}
                            </span>
                            {latestPostQuery.latestPost.publishedUrl && (
                                <a href={latestPostQuery.latestPost.publishedUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                                    View published post
                                </a>
                            )}
                        </div>
                        {latestPostQuery.latestPost.lastError && (
                            <p className="mt-2 text-xs opacity-80">{latestPostQuery.latestPost.lastError}</p>
                        )}
                    </div>
                )}
                <SponsorProofSummary
                    title="Signal Sponsor Proof"
                    runId={proofRunId}
                    artifacts={proofDetail.artifacts}
                    manifest={proofDetail.manifest}
                    proofRefIds={latestSignalDetail.signal?.proofRefIds ?? []}
                    isLoading={proofDetail.isLoading || latestSignalDetail.isLoading}
                    error={proofDetail.error ?? latestSignalDetail.error}
                />
            </div>

            {/* History (Ungated) */}
            <div className="space-y-4 pt-8 border-t border-gray-800">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Signal History</h3>
                        {isHistoryLoading && (
                            <HugeiconsIcon icon={Loading03Icon} className="w-4 h-4 text-cyan-500 animate-spin" />
                        )}
                    </div>

                    <SearchAndSort
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Search by token, name, or analysis..."
                        sortOptions={SORT_OPTIONS}
                        currentSort={sortBy}
                        onSortChange={setSortBy}
                        filters={FILTER_CONFIG}
                        activeFilters={filters}
                        onFilterChange={handleFilterChange}
                        resultCount={historyQuery.total}
                        isLoading={isHistoryLoading || isHistoryRefreshing}
                    />
                </div>

                {displaySignals.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {displaySignals.map((signal) => (
                                <SignalCard key={signal.id} signal={signal} />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-8">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-400 hover:text-white"
                                >
                                    <HugeiconsIcon icon={ArrowLeft01Icon} className="w-5 h-5" />
                                </button>
                                <span className="text-sm text-gray-500">
                                    Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
                                </span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-400 hover:text-white"
                                >
                                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    !isHistoryLoading && (
                        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8 text-center">
                            <p className="text-gray-500">
                                {searchQuery || filters.status !== 'all' || filters.direction !== 'all'
                                    ? 'No signals match your search or filters.'
                                    : 'No signal history available.'}
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
