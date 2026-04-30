import { useState, useMemo, useEffect } from "react";
import { SignalCard } from "../components/SignalCard";
import { XPostButton } from "../components/XPostButton";
import { SearchAndSort } from "../components/ui/SearchAndSort";
import type { SortOption, FilterConfig } from "../components/ui/SearchAndSort";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GpsSignal01Icon,
  Loading03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import type { SignalListItem } from "@omen/shared";
import { useProofFeed } from "../hooks/useProofs";
import { useSignals } from "../hooks/useSignals";
import { useTopology } from "../hooks/useTopology";
import { buildProofBadgeIndex, getProofBadgesForRun } from "../lib/proof-badges";
import type { ProofBadgeState, SignalCardItem } from "../types/ui-models";

const ITEMS_PER_PAGE = 10;

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "confidence-high", label: "Confidence (High)" },
  { value: "confidence-low", label: "Confidence (Low)" },
  { value: "pnl-high", label: "P&L (High)" },
  { value: "pnl-low", label: "P&L (Low)" },
];

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "pending", label: "Pending" },
      { value: "active", label: "Active" },
      { value: "tp_hit", label: "TP Hit" },
      { value: "sl_hit", label: "SL Hit" },
      { value: "closed", label: "Closed" },
    ],
  },
  {
    key: "direction",
    label: "Direction",
    options: [
      { value: "all", label: "All" },
      { value: "long", label: "Long" },
      { value: "short", label: "Short" },
    ],
  },
];

const REFRESH_INTERVAL_MS = 30_000;

const signalMatchesHistoryQuery = (
  signal: SignalListItem | null,
  input: {
    direction: string;
    query: string;
    status: string;
  },
) => {
  if (!signal) {
    return false;
  }

  if (input.status !== "all" && signal.signalStatus !== input.status) {
    return false;
  }

  if (input.direction !== "all" && signal.direction !== input.direction.toUpperCase()) {
    return false;
  }

  const query = input.query.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [signal.asset, signal.direction, signal.whyNow].some((value) =>
    value?.toLowerCase().includes(query),
  );
};

const toSignalCardItem = (
  signal: SignalListItem,
  proofBadges?: ProofBadgeState,
): SignalCardItem => {
  const primaryTarget = signal.targetPrice ?? signal.targets[0]?.price;

  return {
    id: signal.id,
    runId: signal.runId,
    created_at: signal.publishedAt ?? signal.updatedAt ?? signal.createdAt,
    proofBadges,
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
      status: signal.signalStatus ?? "pending",
      pnl_percent: signal.pnlPercent ?? undefined,
      current_price: signal.currentPrice ?? undefined,
      direction: signal.direction,
      asset: signal.asset,
    },
  };
};

export function SignalsPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filters, setFilters] = useState<Record<string, string>>({
    status: "all",
    direction: "all",
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const latestQuery = useSignals({
    limit: 1,
    sort: "newest",
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
  const proofFeed = useProofFeed({
    limit: 50,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });
  const topology = useTopology({ refreshIntervalMs: REFRESH_INTERVAL_MS });

  const latestRawSignal = latestQuery.signals[0] ?? null;
  const proofBadgeIndex = useMemo(
    () => buildProofBadgeIndex(proofFeed.proofs, topology.routes),
    [proofFeed.proofs, topology.routes],
  );
  const latestSignal = latestRawSignal
    ? toSignalCardItem(
        latestRawSignal,
        getProofBadgesForRun(latestRawSignal.runId, proofBadgeIndex),
      )
    : null;
  const latestMatchesHistory = signalMatchesHistoryQuery(latestRawSignal, {
    direction: filters.direction,
    query: searchQuery,
    status: filters.status,
  });
  const displaySignals = useMemo(
    () =>
      historyQuery.signals
        .filter((signal) => signal.id !== latestRawSignal?.id)
        .map((signal) =>
          toSignalCardItem(
            signal,
            getProofBadgesForRun(signal.runId, proofBadgeIndex),
          ),
        ),
    [historyQuery.signals, latestRawSignal?.id, proofBadgeIndex],
  );
  const historyTotal = Math.max(0, historyQuery.total - (latestMatchesHistory ? 1 : 0));
  const totalPages = Math.max(1, Math.ceil(historyTotal / ITEMS_PER_PAGE));
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
        {(latestQuery.isRefreshing || isHistoryRefreshing) && (
          <span className="text-xs text-gray-500">Syncing live data...</span>
        )}
      </div>

      {(latestQuery.error || historyQuery.error) && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Live signal history is unavailable.
        </div>
      )}

      {/* Latest Signal - Always Visible */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Signal</h3>
        <div className="relative">
          <SignalCard signal={latestSignal} isLoading={isStatusLoading} isLatest={true} />
          {latestRawSignal && (
            <XPostButton signalId={latestRawSignal.id} className="absolute bottom-4 right-4 z-10" />
          )}
        </div>
      </div>

      {/* History (Ungated) */}
      <div className="space-y-4 pt-8 border-t border-gray-800">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Signal History
            </h3>
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
            resultCount={historyTotal}
            isLoading={isHistoryLoading || isHistoryRefreshing}
          />
        </div>

        {displaySignals.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displaySignals.map((signal) => (
                <div key={signal.id} className="relative">
                  <SignalCard signal={signal} />
                  <XPostButton signalId={signal.id} className="absolute bottom-4 right-4 z-10" />
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
          !isHistoryLoading && (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-500">
                {searchQuery || filters.status !== "all" || filters.direction !== "all"
                  ? "No signals match your search or filters."
                  : "No signal history available."}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
