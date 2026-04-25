import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SortOption {
  value: string;
  label: string;
  direction?: 'asc' | 'desc';
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface SearchAndSortProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortOptions: SortOption[];
  currentSort: string;
  onSortChange: (value: string) => void;
  filters?: FilterConfig[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  className?: string;
}

export function SearchAndSort({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  sortOptions,
  currentSort,
  onSortChange,
  filters,
  activeFilters,
  onFilterChange,
  className = '',
}: SearchAndSortProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  const currentSortLabel = sortOptions.find((opt) => opt.value === currentSort)?.label || 'Sort by';

  const activeFilterCount = activeFilters
    ? Object.values(activeFilters).filter((v) => v && v !== 'all').length
    : 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setIsFiltersOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      {/* Search Input */}
      <div className="relative flex-1 min-w-0 max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-gray-500" />
        </div>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-10 pl-10 pr-10 bg-gray-900/70 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
        />
        <AnimatePresence>
          {searchValue && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 shrink-0">
        {/* Filters Dropdown */}
        {filters && filters.length > 0 && onFilterChange && (
          <div className="relative" ref={filtersRef}>
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`h-10 px-3.5 flex items-center gap-2 bg-gray-900/70 border rounded-lg text-sm font-medium transition-all ${
                activeFilterCount > 0
                  ? 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10'
                  : 'border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500 text-xs font-bold text-black">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {isFiltersOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    {filters.map((filter) => (
                      <div key={filter.key}>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          {filter.label}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {filter.options.map((option) => {
                            const isActive = activeFilters?.[filter.key] === option.value;
                            return (
                              <button
                                key={option.value}
                                onClick={() => onFilterChange(filter.key, option.value)}
                                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                                  isActive
                                    ? 'bg-cyan-500 text-black'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {activeFilterCount > 0 && (
                    <div className="px-4 py-3 border-t border-gray-800 bg-gray-950/50">
                      <button
                        onClick={() => {
                          filters.forEach((f) => onFilterChange(f.key, 'all'));
                        }}
                        className="text-xs text-gray-500 hover:text-white transition-colors"
                      >
                        Clear all filters
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Sort Dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="h-10 px-3.5 flex items-center gap-2 bg-gray-900/70 border border-gray-800 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
          >
            <span className="hidden sm:inline text-gray-500">Sort:</span>
            <span className="text-white">{currentSortLabel}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isSortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden"
              >
                <div className="py-1.5">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSortChange(option.value);
                        setIsSortOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                        currentSort === option.value
                          ? 'bg-cyan-500/10 text-cyan-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
