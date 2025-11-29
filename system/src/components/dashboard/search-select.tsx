'use client';

import { useState, useMemo, ReactNode, memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil, X, User as UserIcon, ScanLine } from 'lucide-react';
import type { User, Scanner } from '@/types/database';

// ============================================
// GENERIC SEARCH SELECT
// ============================================

interface SearchSelectOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  maxResults?: number;
  icon?: ReactNode;
  className?: string;
}

/**
 * Memoized search select component with dropdown
 */
export const SearchSelect = memo(function SearchSelect({ value, onChange, options, placeholder = 'Select...', emptyMessage = 'No results found', searchPlaceholder = 'Search...', maxResults = 50, icon, className = '' }: SearchSelectProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedOption = options.find((o) => o.id === value);

    const filteredOptions = useMemo(() => {
        if (!searchQuery) {
            return options.slice(0, maxResults);
        }
        const query = searchQuery.toLowerCase();
        return options.filter((opt) => opt.label.toLowerCase().includes(query) || opt.sublabel?.toLowerCase().includes(query)).slice(0, maxResults);
    }, [searchQuery, options, maxResults]);

    const handleSelect = useCallback(
        (id: string) => {
            onChange(id);
            setIsOpen(false);
            setSearchQuery('');
        },
        [onChange]
    );

    const handleClear = useCallback(() => {
        onChange('');
        setSearchQuery('');
    }, [onChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setIsOpen(true);
    }, []);

    const handleFocus = useCallback(() => {
        setIsOpen(true);
    }, []);

    const handleBackdropClick = useCallback(() => {
        setIsOpen(false);
        setSearchQuery('');
    }, []);

    const handleEditClick = useCallback(() => {
        setIsOpen(true);
    }, []);

    return (
        <div className={`relative ${className}`}>
            {value && selectedOption && !isOpen ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-background">
                    <div className="flex items-center gap-2">
                        {icon}
                        <span>{selectedOption.label}</span>
                        {selectedOption.badge && (
                            <Badge variant="secondary" className="text-xs">
                                {selectedOption.badge}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleEditClick}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleClear}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder={searchPlaceholder} value={searchQuery} onChange={handleInputChange} onFocus={handleFocus} className="pl-10" />
                </div>
            )}

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                    {filteredOptions.length === 0 ? (
                        <div className="px-3 py-6 text-center text-muted-foreground">{searchQuery ? emptyMessage : 'Start typing to search'}</div>
                    ) : (
                        <>
                            {filteredOptions.map((option) => (
                                <button key={option.id} type="button" className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between" onClick={() => handleSelect(option.id)}>
                                    <div>
                                        <p className="font-medium">{option.label}</p>
                                        {option.sublabel && <p className="text-xs text-muted-foreground">{option.sublabel}</p>}
                                    </div>
                                    {option.badge && (
                                        <Badge variant="secondary" className="text-xs">
                                            {option.badge}
                                        </Badge>
                                    )}
                                </button>
                            ))}
                            {options.length > maxResults && !searchQuery && <div className="px-3 py-2 text-xs text-muted-foreground border-t">Showing first {maxResults} results. Type to search for more.</div>}
                        </>
                    )}
                </div>
            )}

            {isOpen && <div className="fixed inset-0 z-40" onClick={handleBackdropClick} />}
        </div>
    );
});

// ============================================
// USER SEARCH SELECT
// ============================================

interface UserSearchSelectProps {
  users: User[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Memoized user search select component
 */
export const UserSearchSelect = memo(function UserSearchSelect({ users, value, onChange, placeholder = 'Search users by name or email...', className = '' }: UserSearchSelectProps) {
    const options: SearchSelectOption[] = useMemo(
        () =>
            users.map((user) => ({
                id: user.id,
                label: user.full_name || user.email,
                sublabel: user.full_name ? user.email : undefined,
                badge: user.role
            })),
        [users]
    );

    return <SearchSelect value={value} onChange={onChange} options={options} searchPlaceholder={placeholder} emptyMessage="No users found" icon={<UserIcon className="h-4 w-4 text-muted-foreground" />} className={className} />;
});

// ============================================
// SCANNER SEARCH SELECT
// ============================================

interface ScannerSearchSelectProps {
  scanners: Scanner[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Memoized scanner search select component
 */
export const ScannerSearchSelect = memo(function ScannerSearchSelect({ scanners, value, onChange, placeholder = 'Search scanners by name or location...', className = '' }: ScannerSearchSelectProps) {
    const options: SearchSelectOption[] = useMemo(
        () =>
            scanners.map((scanner) => ({
                id: scanner.id,
                label: scanner.name,
                sublabel: scanner.location
            })),
        [scanners]
    );

    return <SearchSelect value={value} onChange={onChange} options={options} searchPlaceholder={placeholder} emptyMessage="No scanners found" icon={<ScanLine className="h-4 w-4 text-muted-foreground" />} className={className} />;
});
