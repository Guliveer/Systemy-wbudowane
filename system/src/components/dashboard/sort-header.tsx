'use client';

import React, { ReactNode, memo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type SortDirection = 'asc' | 'desc';

interface SortIconProps {
  field: string;
  currentField: string;
  direction: SortDirection;
}

/**
 * Memoized sort icon component
 * Only re-renders when field, currentField, or direction changes
 */
export const SortIcon = memo(function SortIcon({ field, currentField, direction }: SortIconProps) {
    if (currentField !== field) {
        return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    }
    return direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
});

interface SortableHeaderProps {
  field: string;
  currentField: string;
  direction: SortDirection;
  onSort: (field: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Memoized sortable header component
 * Only re-renders when props change
 */
export const SortableHeader = memo(function SortableHeader({ field, currentField, direction, onSort, children, className = '' }: SortableHeaderProps) {
    const handleClick = useCallback(() => {
        onSort(field);
    }, [onSort, field]);

    return (
        <button className={`inline-flex items-center hover:text-foreground ${className}`} onClick={handleClick}>
            {children}
            <SortIcon field={field} currentField={currentField} direction={direction} />
        </button>
    );
});

// Generic typed version for better type safety
interface TypedSortableHeaderProps<T extends string> {
  field: T;
  currentField: T;
  direction: SortDirection;
  onSort: (field: T) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Memoized typed sortable header component with generic type support
 */
export const TypedSortableHeader = memo(function TypedSortableHeader<T extends string>({ field, currentField, direction, onSort, children, className = '' }: TypedSortableHeaderProps<T>) {
    const handleClick = useCallback(() => {
        onSort(field);
    }, [onSort, field]);

    return (
        <button className={`inline-flex items-center hover:text-foreground ${className}`} onClick={handleClick}>
            {children}
            <SortIcon field={field} currentField={currentField} direction={direction} />
        </button>
    );
}) as <T extends string>(props: TypedSortableHeaderProps<T>) => React.ReactElement;
