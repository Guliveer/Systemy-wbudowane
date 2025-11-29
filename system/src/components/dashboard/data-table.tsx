'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Column definition
export interface Column<T> {
  key: string;
  header: string | ReactNode;
  className?: string;
  render: (item: T) => ReactNode;
}

// Action definition
export interface Action<T> {
  label: string | ((item: T) => string);
  icon?: LucideIcon;
  iconGetter?: (item: T) => LucideIcon;
  onClick: (item: T) => void;
  variant?: 'default' | 'destructive';
  show?: (item: T) => boolean;
  separator?: boolean;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

interface DataTableProps<T> {
  title: string;
  description?: string;
  columns: Column<T>[];
  data: T[];
  actions?: Action<T>[];
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  rowClassName?: (item: T) => string;
  pagination?: PaginationProps;
}

// Pagination controls component
function PaginationControls({ currentPage, totalPages, pageSize, totalItems, onPageChange, onPageSizeChange, pageSizeOptions = [20, 50, 100, 500] }: PaginationProps) {
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
            <div className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {totalItems}
            </div>
            <div className="flex items-center gap-2">
                <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(parseInt(value))}>
                    <SelectTrigger className="w-auto h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {pageSizeOptions.map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                                {size} per page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-2">
                        {currentPage} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Table skeleton for loading state
function TableLoadingSkeleton({ columns, rows = 5, hasActions }: { columns: number; rows?: number; hasActions?: boolean }) {
    const totalColumns = hasActions ? columns + 1 : columns;

    return (
        <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        {Array.from({ length: totalColumns }).map((_, i) => (
                            <TableHead key={i}>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {Array.from({ length: totalColumns }).map((_, colIndex) => (
                                <TableCell key={colIndex}>
                                    <Skeleton className={`h-4 ${colIndex === 0 ? 'w-24' : colIndex === totalColumns - 1 ? 'w-8' : 'w-20'}`} />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function DataTable<T>({ title, description, columns, data, actions, isLoading = false, loadingMessage = 'Loading...', emptyMessage = 'No data found', keyExtractor, rowClassName, pagination }: DataTableProps<T>) {
    return (
        <Card className="transition-all duration-200">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
                {isLoading ? (
                    <TableLoadingSkeleton columns={columns.length} rows={5} hasActions={actions && actions.length > 0} />
                ) : data.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
                ) : (
                    <>
                        {pagination && <PaginationControls {...pagination} />}
                        <div className="overflow-x-auto -mx-2 sm:mx-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {columns.map((column) => (
                                            <TableHead key={column.key} className={column.className}>
                                                {column.header}
                                            </TableHead>
                                        ))}
                                        {actions && actions.length > 0 && <TableHead className="w-[70px]"></TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={keyExtractor(item)} className={rowClassName?.(item)}>
                                            {columns.map((column) => (
                                                <TableCell key={column.key} className={column.className}>
                                                    {column.render(item)}
                                                </TableCell>
                                            ))}
                                            {actions && actions.length > 0 && (
                                                <TableCell>
                                                    <ActionsDropdown item={item} actions={actions} />
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {pagination && pagination.totalPages > 1 && <PaginationControls {...pagination} />}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

interface ActionsDropdownProps<T> {
  item: T;
  actions: Action<T>[];
}

function ActionsDropdown<T>({ item, actions }: ActionsDropdownProps<T>) {
    const visibleActions = actions.filter((action) => !action.show || action.show(item));

    if (visibleActions.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {visibleActions.map((action, index) => {
                    const label = typeof action.label === 'function' ? action.label(item) : action.label;
                    const IconComponent = action.iconGetter ? action.iconGetter(item) : action.icon;

                    return (
                        <div key={label}>
                            {action.separator && index > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuItem className={action.variant === 'destructive' ? 'text-destructive' : ''} onClick={() => action.onClick(item)}>
                                {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
                                {label}
                            </DropdownMenuItem>
                        </div>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Simple table without card wrapper
interface SimpleTableProps<T> {
  columns: Column<T>[];
  data: T[];
  actions?: Action<T>[];
  keyExtractor: (item: T) => string;
  rowClassName?: (item: T) => string;
}

export function SimpleTable<T>({ columns, data, actions, keyExtractor, rowClassName }: SimpleTableProps<T>) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map((column) => (
                            <TableHead key={column.key} className={column.className}>
                                {column.header}
                            </TableHead>
                        ))}
                        {actions && actions.length > 0 && <TableHead className="w-[70px]"></TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item) => (
                        <TableRow key={keyExtractor(item)} className={rowClassName?.(item)}>
                            {columns.map((column) => (
                                <TableCell key={column.key} className={column.className}>
                                    {column.render(item)}
                                </TableCell>
                            ))}
                            {actions && actions.length > 0 && (
                                <TableCell>
                                    <ActionsDropdown item={item} actions={actions} />
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
