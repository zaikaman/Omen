import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IntelBlog } from "../components/IntelBlog";
import { IntelCard } from "../components/IntelCard";
import { XPostButton } from "../components/XPostButton";
import { SearchAndSort } from "../components/ui/SearchAndSort";
import type { SortOption, FilterConfig } from "../components/ui/SearchAndSort";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  News01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "../components/ui/button";
import type { Intel, IntelListItem } from "@omen/shared";
import { useIntel, useIntelDetail } from "../hooks/useIntel";
import { useProofFeed } from "../hooks/useProofs";
import { useTopology } from "../hooks/useTopology";
import { buildProofBadgeIndex, getProofBadgesForRun } from "../lib/proof-badges";
import type { ProofBadgeState } from "../types/ui-models";

const ITEMS_PER_PAGE = 9;
const REFRESH_INTERVAL_MS = 30_000;

type CardIntel = {
  id: string;
  runId: string;
  slug: string;
  type: "deep_dive" | "alpha_report";
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
  category: Intel["category"];
  status: Intel["status"];
  symbols: string[];
  confidence: number;
  sources?: Intel["sources"];
  proofRefIds?: string[];
  proofBadges?: ProofBadgeState;
};

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
];

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "type",
    label: "Report Type",
    options: [
      { value: "all", label: "All" },
      { value: "deep_dive", label: "Deep Dive" },
      { value: "alpha_report", label: "Alpha Report" },
    ],
  },
];

const toCardIntel = (
  intel: Intel | IntelListItem,
  proofBadges?: ProofBadgeState,
): CardIntel => ({
  id: intel.id,
  runId: intel.runId,
  slug: intel.slug,
  type: intel.category === "opportunity" ? "deep_dive" : "alpha_report",
  created_at: intel.publishedAt ?? intel.createdAt,
  content: {
    topic: intel.title,
    headline: intel.title,
    tweet_text: intel.summary,
    long_form_content: "body" in intel ? intel.body : intel.summary,
    image_url: intel.imageUrl,
    tldr: intel.summary,
  },
  category: intel.category,
  status: intel.status,
  symbols: intel.symbols,
  confidence: intel.confidence,
  sources: "sources" in intel ? intel.sources : undefined,
  proofRefIds: "proofRefIds" in intel ? intel.proofRefIds : undefined,
  proofBadges,
});

export function IntelPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filters, setFilters] = useState<Record<string, string>>({
    type: "all",
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
  const proofFeed = useProofFeed({
    limit: 50,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const topology = useTopology({ refreshIntervalMs: REFRESH_INTERVAL_MS });

  const proofBadgeIndex = useMemo(
    () => buildProofBadgeIndex(proofFeed.proofs, topology.routes),
    [proofFeed.proofs, topology.routes],
  );
  const intelItems = useMemo(
    () =>
      feedQuery.intel.map((intel) =>
        toCardIntel(
          intel,
          getProofBadgesForRun(intel.runId, proofBadgeIndex),
        ),
      ),
    [feedQuery.intel, proofBadgeIndex],
  );
  const cachedSelectedIntel = useMemo(
    () => intelItems.find((item) => item.id === id || item.slug === id) ?? null,
    [id, intelItems],
  );
  const selectedIntel = detailQuery.intel
    ? toCardIntel(
        detailQuery.intel,
        getProofBadgesForRun(detailQuery.intel.runId, proofBadgeIndex),
      )
    : cachedSelectedIntel;

  const hasActiveFilters =
    searchQuery.trim() !== "" || sortBy !== "newest" || filters.type !== "all";
  const latestIntel =
    !hasActiveFilters && page === 1 && intelItems.length > 0 ? intelItems[0] : null;

  const { displayItems, totalPages } = useMemo(() => {
    const latestId = latestIntel?.id;
    let list = intelItems.filter((it) => it.id !== latestId);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((item) => {
        const topic = item.content?.topic?.toLowerCase() || "";
        const headline = item.content?.headline?.toLowerCase() || "";
        const tweet = item.content?.tweet_text?.toLowerCase() || "";
        const blog = item.content?.blog_post?.toLowerCase() || "";
        const longForm = item.content?.long_form_content?.toLowerCase() || "";
        return (
          topic.includes(query) ||
          headline.includes(query) ||
          tweet.includes(query) ||
          blog.includes(query) ||
          longForm.includes(query)
        );
      });
    }

    if (filters.type !== "all") {
      list = list.filter((item) => {
        if (filters.type === "deep_dive") return item.type === "deep_dive";
        if (filters.type === "alpha_report") return item.type !== "deep_dive";
        return true;
      });
    }

    if (sortBy === "oldest") {
      list = [...list].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } else {
      list = [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
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
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  if (selectedIntel) {
    const content = selectedIntel.content;
    const articleContent =
      content.long_form_content ||
      content.blog_post ||
      content.formatted_thread ||
      content.tweet_text ||
      "";
    const headline = content.headline || content.topic;

    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          className="gap-2 pl-0 hover:pl-2 transition-all text-gray-400 hover:text-white"
          onClick={() => navigate("/app/intel")}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
          Back to Feed
        </Button>
        <div className="flex justify-end">
          <XPostButton intelId={selectedIntel.id} />
        </div>

        <IntelBlog
          title={headline}
          content={articleContent}
          date={new Date(selectedIntel.created_at).toLocaleDateString()}
          imageUrl={content.image_url ?? undefined}
          tldr={content.tldr}
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
          onClick={() => navigate("/app/intel")}
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
        {(feedQuery.isRefreshing || detailQuery.isRefreshing) && (
          <span className="text-xs text-gray-500">Syncing live intel...</span>
        )}
      </div>

      {(feedQuery.error || detailQuery.error) && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Live intel is unavailable.
        </div>
      )}

      {/* Latest Intel - Always Visible when not filtering */}
      {!hasActiveFilters && page === 1 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
            Latest Report
          </h3>
          <div className="relative">
            <IntelCard
              intel={latestIntel}
              isLoading={feedQuery.isLoading}
              error={feedQuery.error}
              onClick={() => latestIntel && navigate(`/app/intel/${latestIntel.id}`)}
            />
            {latestIntel && (
              <XPostButton intelId={latestIntel.id} className="absolute right-3 top-3 z-10" />
            )}
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
                <div key={intel.id} className="relative">
                  <IntelCard intel={intel} onClick={() => navigate(`/app/intel/${intel.id}`)} />
                  <XPostButton intelId={intel.id} className="absolute right-3 top-3 z-10" />
                </div>
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
                  Page <span className="text-white">{page}</span> of{" "}
                  <span className="text-white">{totalPages}</span>
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
                className={`w-8 h-8 text-gray-600 ${feedQuery.isLoading ? "animate-spin" : ""}`}
              />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {feedQuery.isLoading
                ? "Loading Reports"
                : searchQuery || filters.type !== "all"
                  ? "No Matching Reports"
                  : "No Archived Reports"}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {feedQuery.isLoading
                ? "Fetching live swarm intelligence from the backend."
                : searchQuery || filters.type !== "all"
                  ? "Try adjusting your search or filters."
                  : "Older intelligence reports will appear here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
