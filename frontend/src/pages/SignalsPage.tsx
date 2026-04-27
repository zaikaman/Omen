import { useState, useMemo, useEffect } from 'react';
import { SignalCard } from '../components/SignalCard';
import { SearchAndSort } from '../components/ui/SearchAndSort';
import type { SortOption, FilterConfig } from '../components/ui/SearchAndSort';
import { HugeiconsIcon } from '@hugeicons/react';
import { GpsSignal01Icon, Loading03Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
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

const mockLatestSignal: SignalCardItem = {
    id: 'latest',
    created_at: new Date().toISOString(),
    content: {
        token: { symbol: 'OMEN', name: 'Omen Protocol' },
        confidence: 88,
        analysis: 'Strong momentum detected. Technical structure favors upside.',
        entry_price: 1.25,
        target_price: 1.50,
        stop_loss: 1.15,
        status: 'active',
        pnl_percent: 5.2,
        current_price: 1.28,
        direction: 'LONG'
    }
};

const mockHistorySignals: SignalCardItem[] = [
    {
        id: 'history-1',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        content: {
            token: { symbol: 'ETH', name: 'Ethereum' },
            confidence: 95,
            analysis: 'ETH breaking resistance at $3,500. Expected to test $4k soon.',
            entry_price: 3500,
            target_price: 4000,
            stop_loss: 3300,
            status: 'tp_hit',
            pnl_percent: 14.2,
            current_price: 4020,
            direction: 'LONG'
        }
    },
    {
        id: 'history-2',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        content: {
            token: { symbol: 'SOL', name: 'Solana' },
            confidence: 72,
            analysis: 'Solana showing weakness. MACD crossover indicated.',
            entry_price: 150,
            target_price: 120,
            stop_loss: 165,
            status: 'sl_hit',
            pnl_percent: -10,
            current_price: 165,
            direction: 'SHORT'
        }
    },
    {
        id: 'history-3',
        created_at: new Date(Date.now() - 259200000).toISOString(),
        content: {
            token: { symbol: 'BTC', name: 'Bitcoin' },
            confidence: 80,
            analysis: 'Bitcoin consolidating. Potential breakout above $68k.',
            entry_price: 66000,
            target_price: 70000,
            stop_loss: 64000,
            status: 'active',
            pnl_percent: 1.5,
            current_price: 67000,
            direction: 'LONG'
        }
    }
];

export function SignalsPage() {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [filters, setFilters] = useState<Record<string, string>>({
        status: 'all',
        direction: 'all',
    });

    const isStatusLoading = false;
    const isHistoryLoading = false;

    useEffect(() => {
        setPage(1);
    }, [searchQuery, sortBy, filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const latestSignal = mockLatestSignal;
    const historySignals = mockHistorySignals;

    const { displaySignals, totalPages } = useMemo(() => {
        let list: SignalCardItem[] = [...historySignals];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter((s) => {
                const symbol = s.content?.token?.symbol?.toLowerCase() || '';
                const name = s.content?.token?.name?.toLowerCase() || '';
                const analysis = s.content?.analysis?.toLowerCase() || '';
                return symbol.includes(query) || name.includes(query) || analysis.includes(query);
            });
        }

        // Status filter
        if (filters.status !== 'all') {
            list = list.filter((s) => s.content?.status === filters.status);
        }

        // Direction filter
        if (filters.direction !== 'all') {
            list = list.filter((s) => {
                const entryPrice = s.content?.entry_price || 0;
                const targetPrice = s.content?.target_price || 0;
                const direction = s.content?.direction || (targetPrice > entryPrice ? 'LONG' : 'SHORT');
                return direction.toLowerCase() === filters.direction;
            });
        }

        // Sort
        list = [...list].sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'confidence-high':
                    return (b.content?.confidence || 0) - (a.content?.confidence || 0);
                case 'confidence-low':
                    return (a.content?.confidence || 0) - (b.content?.confidence || 0);
                case 'pnl-high':
                    return (b.content?.pnl_percent || 0) - (a.content?.pnl_percent || 0);
                case 'pnl-low':
                    return (a.content?.pnl_percent || 0) - (b.content?.pnl_percent || 0);
                case 'newest':
                default:
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
        });

        const totalPagesCount = Math.ceil(list.length / ITEMS_PER_PAGE) || 1;
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const paginatedList = list.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        return {
            displaySignals: paginatedList,
            totalPages: totalPagesCount,
        };
    }, [historySignals, searchQuery, sortBy, filters, page]);

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
            </div>

            {/* Latest Signal - Always Visible */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Signal</h3>
                <SignalCard signal={latestSignal} isLoading={isStatusLoading} isLatest={true} />
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
