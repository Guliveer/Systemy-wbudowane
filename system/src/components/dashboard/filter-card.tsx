'use client';

import { ReactNode, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Search, X, Trash2 } from 'lucide-react';

// ============================================
// FILTER CARD
// ============================================

interface FilterCardProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

/**
 * Memoized filter card container
 */
export const FilterCard = memo(function FilterCard({ children, title = 'Filters', className = '' }: FilterCardProps) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
});

// ============================================
// SEARCH INPUT
// ============================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Memoized search input component
 */
export const SearchInput = memo(function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }: SearchInputProps) {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value);
        },
        [onChange]
    );

    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={placeholder} value={value} onChange={handleChange} className="pl-10" />
        </div>
    );
});

// ============================================
// FILTER SELECT
// ============================================

interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  className?: string;
}

/**
 * Memoized filter select component
 */
export const FilterSelect = memo(function FilterSelect({ value, onChange, options, placeholder, className = 'w-[140px]' }: FilterSelectProps) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
});

// ============================================
// CLEAR FILTERS BUTTON
// ============================================

interface ClearFiltersButtonProps {
  onClick: () => void;
  show: boolean;
  variant?: 'default' | 'icon';
  className?: string;
}

/**
 * Memoized clear filters button
 */
export const ClearFiltersButton = memo(function ClearFiltersButton({ onClick, show, variant = 'default', className = '' }: ClearFiltersButtonProps) {
    if (!show) { return null; }

    if (variant === 'icon') {
        return (
            <Button variant="outline" size="icon" onClick={onClick} className={className}>
                <X className="h-4 w-4" />
            </Button>
        );
    }

    return (
        <Button variant="outline" onClick={onClick} className={className}>
            <Trash2 className="mr-2 h-4 w-4" />
      Clear
        </Button>
    );
});

// ============================================
// FILTER ROW (common layout)
// ============================================

interface FilterRowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Memoized filter row layout component
 */
export const FilterRow = memo(function FilterRow({ children, className = '' }: FilterRowProps) {
    return <div className={`flex flex-wrap gap-4 ${className}`}>{children}</div>;
});

// ============================================
// FILTER GRID (common layout)
// ============================================

interface FilterGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Memoized filter grid layout component
 */
export const FilterGrid = memo(function FilterGrid({ children, className = '' }: FilterGridProps) {
    return <div className={`grid gap-4 md:grid-cols-2 ${className}`}>{children}</div>;
});

// ============================================
// COMMON FILTER OPTIONS
// ============================================

export const STATUS_FILTER_OPTIONS: FilterSelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' }
];

export const STATUS_WITH_EXPIRED_OPTIONS: FilterSelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'expired', label: 'Expired' }
];

export const ROLE_FILTER_OPTIONS: FilterSelectOption[] = [
    { value: 'all', label: 'All Roles' },
    { value: 'root', label: 'Root' },
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' }
];

export const DATE_FILTER_OPTIONS: FilterSelectOption[] = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'year', label: 'Last Year' }
];
