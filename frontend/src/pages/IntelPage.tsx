import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IntelBlog } from '../components/IntelBlog';
import { IntelCard } from '../components/IntelCard';
import { IntelThread } from '../components/IntelThread';
import { SponsorProofSummary } from '../components/proofs/SponsorProofSummary';
import { SearchAndSort } from '../components/ui/SearchAndSort';
import type { SortOption, FilterConfig } from '../components/ui/SearchAndSort';
import { HugeiconsIcon } from '@hugeicons/react';
import { News01Icon, ArrowLeft01Icon, ArrowRight01Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { Button } from '../components/ui/button';
import type { Intel, IntelListItem } from '@omen/shared';
import { useIntel, useIntelDetail } from '../hooks/useIntel';
import { usePosts } from '../hooks/usePosts';
import { useProofDetail } from '../hooks/useProofs';

const ITEMS_PER_PAGE = 9;
const REFRESH_INTERVAL_MS = 30_000;

type CardIntel = {
    id: string;
    runId: string;
    slug: string;
    type: 'deep_dive' | 'alpha_report';
    created_at: string;
    content: {
        topic: string;
        headline: string;
        tweet_text: string;
        long_form_content: string;
        blog_post?: string;
        formatted_thread?: string;
        image_url?: string | null;
        tldr?: string;
    };
    category: Intel['category'];
    status: Intel['status'];
    symbols: string[];
    confidence: number;
    sources?: Intel['sources'];
    proofRefIds?: string[];
};

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

const toCardIntel = (intel: Intel | IntelListItem): CardIntel => ({
    id: intel.id,
    runId: intel.runId,
    slug: intel.slug,
    type: intel.category === 'opportunity' ? 'deep_dive' : 'alpha_report',
    created_at: intel.publishedAt ?? intel.createdAt,
    content: {
        topic: intel.title,
        headline: intel.title,
        tweet_text: intel.summary,
        long_form_content: 'body' in intel ? intel.body : intel.summary,
        image_url: intel.imageUrl,
        tldr: intel.summary,
    },
    category: intel.category,
    status: intel.status,
    symbols: intel.symbols,
    confidence: intel.confidence,
    sources: 'sources' in intel ? intel.sources : undefined,
    proofRefIds: 'proofRefIds' in intel ? intel.proofRefIds : undefined,
});

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

    const feedQuery = useIntel({
        limit: 50,
        query: searchQuery.trim() || undefined,
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
    const detailQuery = useIntelDetail(id, {
        enabled: Boolean(id),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });

    const intelItems = useMemo(
        () => feedQuery.intel.map(toCardIntel),
        [feedQuery.intel],
    );
    const cachedSelectedIntel = useMemo(
        () => intelItems.find((item) => item.id === id || item.slug === id) ?? null,
        [id, intelItems],
    );
    const selectedIntel = detailQuery.intel ? toCardIntel(detailQuery.intel) : cachedSelectedIntel;

    const latestIntel = page === 1 && intelItems.length > 0 ? intelItems[0] : null;
    const proofRunId = selectedIntel?.runId ?? latestIntel?.runId ?? null;
    const proofDetail = useProofDetail(proofRunId, {
        enabled: Boolean(proofRunId),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
    const selectedPostQuery = usePosts({
        intelId: selectedIntel?.id ?? latestIntel?.id,
        enabled: Boolean(selectedIntel?.id ?? latestIntel?.id),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
    });

    const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'newest' || filters.type !== 'all';

    const { displayItems, totalPages } = useMemo(() => {
        const latestId = latestIntel?.id;
        let list = intelItems.filter((it) => it.id !== latestId);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter((item) => {
                const topic = item.content?.topic?.toLowerCase() || '';
                const headline = item.content?.headline?.toLowerCase() || '';
                const tweet = item.content?.tweet_text?.toLowerCase() || '';
                const blog = item.content?.blog_post?.toLowerCase() || '';
                const longForm = item.content?.long_form_content?.toLowerCase() || '';
                return topic.includes(query) || headline.includes(query) || tweet.includes(query) || blog.includes(query) || longForm.includes(query);
            });
        }

        if (filters.type !== 'all') {
            list = list.filter((item) => {
                if (filters.type === 'deep_dive') return item.type === 'deep_dive';
                if (filters.type === 'alpha_report') return item.type !== 'deep_dive';
                return true;
            });
        }

        if (sortBy === 'oldest') {
            list = [...list].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
        } else {
            list = [...list].sort((a, b) =>
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

    const handlePrevPage = () => {
        if (page > 1) setPage(p => p - 1);
    };

    const handleNextPage = () => {
        if (page < totalPages) setPage(p => p + 1);
    };

    if (selectedIntel) {
        const content = selectedIntel.content;
        const articleContent = content.long_form_content || content.blog_post || content.formatted_thread || content.tweet_text || '';
        const headline = content.headline || content.topic;
        const threadContent = [
            selectedIntel.content.tldr,
            selectedIntel.content.long_form_content,
        ].filter(Boolean).join('\n\n');

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
                    imageUrl={content.image_url ?? undefined}
                    tldr={content.tldr}
                    category={selectedIntel.category}
                    status={selectedIntel.status}
                    symbols={selectedIntel.symbols}
                    confidence={selectedIntel.confidence}
                    sources={selectedIntel.sources}
                    proofRefIds={selectedIntel.proofRefIds}
                />

                {selectedPostQuery.latestPost && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${postStatusClassName(selectedPostQuery.latestPost.status)}`}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-mono uppercase">
                                X delivery: {selectedPostQuery.latestPost.status.replace(/_/g, ' ')}
                            </span>
                            {selectedPostQuery.latestPost.publishedUrl && (
                                <a href={selectedPostQuery.latestPost.publishedUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                                    View published post
                                </a>
                            )}
                        </div>
                        {selectedPostQuery.latestPost.lastError && (
                            <p className="mt-2 text-xs opacity-80">{selectedPostQuery.latestPost.lastError}</p>
                        )}
                    </div>
                )}

                <SponsorProofSummary
                    title="Report Sponsor Proof"
                    runId={proofRunId}
                    artifacts={proofDetail.artifacts}
                    manifest={proofDetail.manifest}
                    proofRefIds={selectedIntel.proofRefIds ?? []}
                    isLoading={proofDetail.isLoading}
                    error={proofDetail.error}
                />

                <IntelThread
                    title={headline}
                    content={threadContent}
                    symbols={selectedIntel.symbols}
                    sources={selectedIntel.sources}
                />
            </div>
        );
    }

    if (id && detailQuery.isLoading) {
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
                <div className="h-96 bg-gray-900/50 animate-pulse border border-gray-800" />
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
                {(feedQuery.isRefreshing || detailQuery.isRefreshing || proofDetail.isRefreshing || selectedPostQuery.isRefreshing) && <span className="text-xs text-gray-500">Syncing live intel...</span>}
            </div>

            {(feedQuery.error || detailQuery.error) && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                    Live intel is unavailable. Seeded fallback data may be shown.
                </div>
            )}

            {/* Latest Intel - Always Visible when not filtering */}
            {!hasActiveFilters && page === 1 && (
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Latest Report</h3>
                    <IntelCard
                        intel={latestIntel}
                        isLoading={feedQuery.isLoading}
                        error={feedQuery.error}
                        onClick={() => latestIntel && navigate(`/app/intel/${latestIntel.id}`)}
                    />
                    {selectedPostQuery.latestPost && (
                        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${postStatusClassName(selectedPostQuery.latestPost.status)}`}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <span className="font-mono uppercase">
                                    X delivery: {selectedPostQuery.latestPost.status.replace(/_/g, ' ')}
                                </span>
                                {selectedPostQuery.latestPost.publishedUrl && (
                                    <a href={selectedPostQuery.latestPost.publishedUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                                        View published post
                                    </a>
                                )}
                            </div>
                            {selectedPostQuery.latestPost.lastError && (
                                <p className="mt-2 text-xs opacity-80">{selectedPostQuery.latestPost.lastError}</p>
                            )}
                        </div>
                    )}
                    <div className="mt-4">
                        <SponsorProofSummary
                            title="Latest Report Proof"
                            runId={proofRunId}
                            artifacts={proofDetail.artifacts}
                            manifest={proofDetail.manifest}
                            proofRefIds={latestIntel?.proofRefIds ?? []}
                            isLoading={proofDetail.isLoading}
                            error={proofDetail.error}
                        />
                    </div>
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
                        resultCount={displayItems.length}
                        isLoading={feedQuery.isLoading || feedQuery.isRefreshing}
                    />
                </div>

                {displayItems.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayItems.map((intel) => (
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
                            <HugeiconsIcon
                                icon={feedQuery.isLoading ? Loading03Icon : News01Icon}
                                className={`w-8 h-8 text-gray-600 ${feedQuery.isLoading ? 'animate-spin' : ''}`}
                            />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">
                            {feedQuery.isLoading ? 'Loading Reports' : searchQuery || filters.type !== 'all' ? 'No Matching Reports' : 'No Archived Reports'}
                        </h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            {feedQuery.isLoading
                                ? 'Fetching live swarm intelligence from the backend.'
                                : searchQuery || filters.type !== 'all'
                                ? 'Try adjusting your search or filters.'
                                : 'Older intelligence reports will appear here.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
