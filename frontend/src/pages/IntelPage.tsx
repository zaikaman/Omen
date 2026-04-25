import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IntelBlog } from '../components/IntelBlog';
import { IntelCard } from '../components/IntelCard';
import { SearchAndSort, SortOption, FilterConfig } from '../components/ui/SearchAndSort';
import { HugeiconsIcon } from '@hugeicons/react';
import { News01Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Button } from '../components/ui/button';

const ITEMS_PER_PAGE = 9;

const SORT_OPTIONS: SortOption[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
];

const FILTER_CONFIG: FilterConfig[] = [
    {
        key: 'type',
        label: 'Report Type',
        options: [
            { value: 'all', label: 'All' },
            { value: 'deep_dive', label: 'Deep Dive' },
            { value: 'alpha_report', label: 'Alpha Report' },
        ],
    },
];

const mockIntelItems = [
    {
        id: 'mock-1',
        type: 'deep_dive',
        created_at: new Date().toISOString(),
        content: {
            topic: 'Omen Network Upgrade Phase 2',
            headline: 'Omen Network Upgrade Phase 2: Autonomous Scaling',
            tweet_text: 'Omen core developers announce major stability update coming next week improving node synchronization times safely.',
            long_form_content: '# Stability Upgrade Phase 2\n\nThe Omen network is preparing for a massive core upgrade aimed at accelerating our autonomous trade verifications and predictive model synchronization across the cluster.\n\n### Why this matters\nBy implementing sharded model loading, Omen agents will respond to sub-second mempool anomalies in a fraction of the time, dramatically boosting the win rate for short-interval scalping trades.\n\n### Timeline\nDeployment is tentatively scheduled for block 14,200,500.'
        }
    },
    {
        id: 'mock-2',
        type: 'alpha_report',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        content: {
            topic: 'Layer 2 Expansion Opportunities',
            headline: 'Layer 2 Sentiments Showing Massive Shift to Fraxtal',
            tweet_text: 'On-chain analytics reveal a sudden spike in bridging activity towards Fraxtal ecosystems.',
            long_form_content: '# Ecosystem Rotation\n\nThe smart money wallets we monitor have silently moved $200M+ into Fraxtal-native dApps over the last 48 hours. This early rotation typically precedes a major narrative pivot. Keep an eye on Frax ecosystem tokens.'
        }
    },
    {
        id: 'mock-3',
        type: 'alpha_report',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        content: {
            topic: 'DeFi Options Growth',
            headline: 'Decentralized Options Volume Hits Weekly ATH',
            tweet_text: 'Options trading is capturing mindshare entirely independent of spot volume trends.',
            long_form_content: '# Options Narrative\n\nUnlike traditional volume, option premiums are seeing irrational pricing on lower cap alts. The Omen sentiment tracker indicates that traders are piling into deep OTM calls expecting a major breakout.'
        }
    }
];

export function IntelPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [filters, setFilters] = useState<Record<string, string>>({
        type: 'all',
    });

    useEffect(() => {
        setPage(1);
    }, [searchQuery, sortBy, filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const intelItems = mockIntelItems;
    const latestIntel = page === 1 && intelItems.length > 0 ? intelItems[0] : null;

    const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'newest' || filters.type !== 'all';

    const { displayItems, totalPages } = useMemo(() => {
        const latestId = latestIntel?.id;
        let list = intelItems.filter((it: any) => it.id !== latestId);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter((item: any) => {
                const topic = item.content?.topic?.toLowerCase() || '';
                const headline = item.content?.headline?.toLowerCase() || '';
                const tweet = item.content?.tweet_text?.toLowerCase() || '';
                const blog = item.content?.blog_post?.toLowerCase() || '';
                const longForm = item.content?.long_form_content?.toLowerCase() || '';
                return topic.includes(query) || headline.includes(query) || tweet.includes(query) || blog.includes(query) || longForm.includes(query);
            });
        }

        if (filters.type !== 'all') {
            list = list.filter((item: any) => {
                if (filters.type === 'deep_dive') return item.type === 'deep_dive';
                if (filters.type === 'alpha_report') return item.type !== 'deep_dive';
                return true;
            });
        }

        if (sortBy === 'oldest') {
            list = [...list].sort((a: any, b: any) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
        } else {
            list = [...list].sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        }

        const totalPagesCount = Math.ceil(list.length / ITEMS_PER_PAGE) || 1;
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const paginatedList = list.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        return {
            displayItems: paginatedList,
            totalPages: totalPagesCount,
        };
    }, [intelItems, latestIntel, searchQuery, sortBy, filters, page]);

    const selectedIntel = id ? mockIntelItems.find(item => item.id === id) : null;

    const handlePrevPage = () => {
        if (page > 1) setPage(p => p - 1);
    };

    const handleNextPage = () => {
        if (page < totalPages) setPage(p => p + 1);
    };

    if (selectedIntel) {
        const content = selectedIntel.content as any;
        const articleContent = content.long_form_content || content.blog_post || content.formatted_thread || content.tweet_text || '';
        const headline = content.headline || content.topic;

        return (
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    className="gap-2 pl-0 hover:pl-2 transition-all text-gray-400 hover:text-white"
                    onClick={() => navigate('/app/intel')}
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
                    Back to Feed
                </Button>

                <IntelBlog
                    title={headline}
                    content={articleContent}
                    date={new Date(selectedIntel.created_at).toLocaleDateString()}
                    imageUrl={content.image_url}
                    tldr={content.tldr}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <HugeiconsIcon icon={News01Icon} className="w-6 h-6 text-cyan-500" />
                        Intel Feed
                    </h2>
                    <p className="text-gray-400 mt-1">Deep dive analysis and raw intelligence streams.</p>
                </div>
            </div>

            {/* Latest Intel - Always Visible when not filtering */}
            {latestIntel && !hasActiveFilters && page === 1 && (
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Latest Report</h3>
                    <IntelCard intel={latestIntel} onClick={() => navigate(`/app/intel/${latestIntel.id}`)} />
                </div>
            )}

            {/* History (Ungated) */}
            <div className="space-y-4">
                <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Archive</h3>

                    <SearchAndSort
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Search reports..."
                        sortOptions={SORT_OPTIONS}
                        currentSort={sortBy}
                        onSortChange={setSortBy}
                        filters={FILTER_CONFIG}
                        activeFilters={filters}
                        onFilterChange={handleFilterChange}
                    />
                </div>

                {displayItems.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayItems.map((intel: any) => (
                                <IntelCard
                                    key={intel.id}
                                    intel={intel}
                                    onClick={() => navigate(`/app/intel/${intel.id}`)}
                                />
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
                    <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-12 text-center">
                        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HugeiconsIcon icon={News01Icon} className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">
                            {searchQuery || filters.type !== 'all' ? 'No Matching Reports' : 'No Archived Reports'}
                        </h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            {searchQuery || filters.type !== 'all'
                                ? 'Try adjusting your search or filters.'
                                : 'Older intelligence reports will appear here.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
