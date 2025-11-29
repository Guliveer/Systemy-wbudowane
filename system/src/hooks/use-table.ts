'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDebounce } from './use-debounce';

// ============================================
// SORTING HOOK
// ============================================

type SortDirection = 'asc' | 'desc';

interface UseSortOptions<T extends string> {
  defaultField: T;
  defaultDirection?: SortDirection;
}

interface UseSortReturn<T extends string> {
  sortField: T;
  sortDirection: SortDirection;
  toggleSort: (field: T) => void;
  setSortField: (field: T) => void;
  setSortDirection: (direction: SortDirection) => void;
}

export function useSort<T extends string>({ defaultField, defaultDirection = 'desc' }: UseSortOptions<T>): UseSortReturn<T> {
    const [sortField, setSortField] = useState<T>(defaultField);
    const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

    const toggleSort = useCallback(
        (field: T) => {
            if (sortField === field) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortField(field);
                setSortDirection('asc');
            }
        },
        [sortField]
    );

    return {
        sortField,
        sortDirection,
        toggleSort,
        setSortField,
        setSortDirection
    };
}

// ============================================
// PAGINATION HOOK
// ============================================

interface UsePaginationOptions {
  defaultPageSize?: number;
  defaultPage?: number;
}

interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;
  resetPage: () => void;
  getPaginatedData: <T>(data: T[]) => T[];
  getTotalPages: (totalItems: number) => number;
}

export function usePagination({ defaultPageSize = 50, defaultPage = 1 }: UsePaginationOptions = {}): UsePaginationReturn {
    const [currentPage, setCurrentPage] = useState(defaultPage);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const handlePageChange = useCallback((page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handlePageSizeChange = useCallback((size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    }, []);

    const resetPage = useCallback(() => {
        setCurrentPage(1);
    }, []);

    const getPaginatedData = useCallback(
    <T>(data: T[]): T[] => {
        const startIndex = (currentPage - 1) * pageSize;
        return data.slice(startIndex, startIndex + pageSize);
    },
    [currentPage, pageSize]
    );

    const getTotalPages = useCallback(
        (totalItems: number): number => {
            return Math.ceil(totalItems / pageSize);
        },
        [pageSize]
    );

    return {
        currentPage,
        pageSize,
        setCurrentPage,
        setPageSize,
        handlePageChange,
        handlePageSizeChange,
        resetPage,
        getPaginatedData,
        getTotalPages
    };
}

// ============================================
// FILTER HOOK
// ============================================

interface UseFilterOptions<T extends Record<string, unknown>> {
  defaultFilters: T;
  defaultSearchQuery?: string;
  searchDebounceMs?: number;
}

interface UseFilterReturn<T extends Record<string, unknown>> {
  /** The immediate search query value (for input display) */
  searchQuery: string;
  /** The debounced search query value (for filtering) */
  debouncedSearchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setFilters: (filters: T) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useFilter<T extends Record<string, unknown>>({ defaultFilters, defaultSearchQuery = '', searchDebounceMs = 300 }: UseFilterOptions<T>): UseFilterReturn<T> {
    const [searchQuery, setSearchQuery] = useState(defaultSearchQuery);
    const [filters, setFilters] = useState<T>(defaultFilters);

    // Debounce search query for performance
    const debouncedSearchQuery = useDebounce(searchQuery, searchDebounceMs);

    const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setFilters(defaultFilters);
    }, [defaultFilters]);

    const hasActiveFilters = useMemo(() => {
        if (searchQuery) { return true; }
        return Object.entries(filters).some(([key, value]) => {
            const defaultValue = defaultFilters[key as keyof T];
            return value !== defaultValue;
        });
    }, [searchQuery, filters, defaultFilters]);

    return {
        searchQuery,
        debouncedSearchQuery,
        setSearchQuery,
        filters,
        setFilter,
        setFilters,
        clearFilters,
        hasActiveFilters
    };
}

// ============================================
// COMBINED TABLE HOOK
// ============================================

interface UseTableOptions<TSort extends string, TFilters extends Record<string, unknown>> {
  sort: UseSortOptions<TSort>;
  pagination?: UsePaginationOptions;
  filter: UseFilterOptions<TFilters>;
}

interface UseTableReturn<TSort extends string, TFilters extends Record<string, unknown>> {
  // Sort
  sortField: TSort;
  sortDirection: SortDirection;
  toggleSort: (field: TSort) => void;
  setSortField: (field: TSort) => void;
  setSortDirection: (direction: SortDirection) => void;
  // Pagination
  currentPage: number;
  pageSize: number;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;
  getPaginatedData: <T>(data: T[]) => T[];
  getTotalPages: (totalItems: number) => number;
  // Filter
  /** The immediate search query value (for input display) */
  searchQuery: string;
  /** The debounced search query value (for filtering) - use this in useMemo for filtering */
  debouncedSearchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: TFilters;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  // Combined
  resetAll: () => void;
}

export function useTable<TSort extends string, TFilters extends Record<string, unknown>>({ sort: sortOptions, pagination: paginationOptions = {}, filter: filterOptions }: UseTableOptions<TSort, TFilters>): UseTableReturn<TSort, TFilters> {
    const sortState = useSort(sortOptions);
    const paginationState = usePagination(paginationOptions);
    const filterState = useFilter(filterOptions);

    // Reset page when debounced search, filters or sort changes
    useEffect(() => {
        paginationState.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterState.debouncedSearchQuery, filterState.filters, sortState.sortField, sortState.sortDirection]);

    const resetAll = useCallback(() => {
        sortState.setSortField(sortOptions.defaultField);
        sortState.setSortDirection(sortOptions.defaultDirection || 'desc');
        paginationState.resetPage();
        filterState.clearFilters();
    }, [sortOptions.defaultField, sortOptions.defaultDirection, sortState, paginationState, filterState]);

    return {
    // Sort
        sortField: sortState.sortField,
        sortDirection: sortState.sortDirection,
        toggleSort: sortState.toggleSort,
        setSortField: sortState.setSortField,
        setSortDirection: sortState.setSortDirection,
        // Pagination
        currentPage: paginationState.currentPage,
        pageSize: paginationState.pageSize,
        handlePageChange: paginationState.handlePageChange,
        handlePageSizeChange: paginationState.handlePageSizeChange,
        getPaginatedData: paginationState.getPaginatedData,
        getTotalPages: paginationState.getTotalPages,
        // Filter
        searchQuery: filterState.searchQuery,
        debouncedSearchQuery: filterState.debouncedSearchQuery,
        setSearchQuery: filterState.setSearchQuery,
        filters: filterState.filters,
        setFilter: filterState.setFilter,
        clearFilters: filterState.clearFilters,
        hasActiveFilters: filterState.hasActiveFilters,
        // Combined
        resetAll
    };
}

// ============================================
// SORTING UTILITIES
// ============================================

type SortValue = string | number | boolean | Date | null | undefined;

export function sortData<T>(data: T[], sortField: keyof T, sortDirection: SortDirection, getValue?: (item: T, field: keyof T) => SortValue): T[] {
    return [...data].sort((a, b) => {
        const aValue = getValue ? getValue(a, sortField) : (a[sortField] as SortValue);
        const bValue = getValue ? getValue(b, sortField) : (b[sortField] as SortValue);

        // Handle null/undefined values
        if (aValue == null && bValue == null) { return 0; }
        if (aValue == null) { return sortDirection === 'asc' ? 1 : -1; }
        if (bValue == null) { return sortDirection === 'asc' ? -1 : 1; }

        // Handle booleans
        if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
            const result = aValue === bValue ? 0 : aValue ? 1 : -1;
            return sortDirection === 'asc' ? result : -result;
        }

        // Handle dates
        if (aValue instanceof Date && bValue instanceof Date) {
            const result = aValue.getTime() - bValue.getTime();
            return sortDirection === 'asc' ? result : -result;
        }

        // Handle numbers
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Handle strings
        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
    });
}
