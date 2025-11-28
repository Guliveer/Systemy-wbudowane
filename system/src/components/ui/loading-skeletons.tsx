"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

// Table skeleton for data tables
interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({ columns = 4, rows = 5, showHeader = true, className }: TableSkeletonProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        {showHeader && (
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex} className="animate-pulse">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className={cn("h-4", colIndex === 0 ? "w-32" : colIndex === columns - 1 ? "w-16" : "w-24")} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Card skeleton for stat cards
interface StatCardSkeletonProps {
  className?: string;
}

export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <Card className={cn("animate-pulse", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// Grid of stat card skeletons
interface StatCardsSkeletonProps {
  count?: number;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function StatCardsSkeleton({ count = 4, columns = 4, className }: StatCardsSkeletonProps) {
  const colsClass = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
  };

  return (
    <div className={cn(`grid gap-4 ${colsClass[columns]}`, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Data table card skeleton (full card with table)
interface DataTableSkeletonProps {
  columns?: number;
  rows?: number;
  showTitle?: boolean;
  className?: string;
}

export function DataTableSkeleton({ columns = 4, rows = 5, showTitle = true, className }: DataTableSkeletonProps) {
  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
      )}
      <CardContent className="px-2 sm:px-6">
        <TableSkeleton columns={columns} rows={rows} />
      </CardContent>
    </Card>
  );
}

// List skeleton for simple lists
interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  className?: string;
}

export function ListSkeleton({ items = 5, showAvatar = false, className }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Form skeleton
interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 3, className }: FormSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2 animate-pulse">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-24 mt-4" />
    </div>
  );
}

// Page header skeleton
export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 animate-pulse", className)}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

// Dashboard page skeleton (combines multiple skeletons)
interface DashboardSkeletonProps {
  statCards?: number;
  tableRows?: number;
  className?: string;
}

export function DashboardSkeleton({ statCards = 4, tableRows = 5, className }: DashboardSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={statCards} />
      <DataTableSkeleton rows={tableRows} />
    </div>
  );
}

// Sidebar user skeleton
export function SidebarUserSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 animate-pulse", className)}>
      <Skeleton className="h-8 w-8 rounded-lg" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

// Badge skeleton
export function BadgeSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-16 rounded-full", className)} />;
}

// Button skeleton
interface ButtonSkeletonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ButtonSkeleton({ size = "md", className }: ButtonSkeletonProps) {
  const sizeClasses = {
    sm: "h-8 w-16",
    md: "h-10 w-24",
    lg: "h-12 w-32",
  };

  return <Skeleton className={cn(sizeClasses[size], "rounded-md", className)} />;
}

// Chart/Graph skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 animate-pulse", className)}>
      <div className="flex items-end gap-2 h-32">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }} />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}
