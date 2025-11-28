'use client';

import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconClassName?: string;
  trend?: string;
  isLoading?: boolean;
}

export function StatCard({ title, value, description, icon: Icon, iconClassName, trend, isLoading }: StatCardProps) {
    const showLoading = isLoading || value === '...';

    return (
        <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={cn('h-4 w-4 transition-colors', iconClassName || 'text-muted-foreground')} />
            </CardHeader>
            <CardContent>
                {showLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-16" />
                        {description && <Skeleton className="h-3 w-32" />}
                        {trend && <Skeleton className="h-3 w-24 mt-1" />}
                    </div>
                ) : (
                    <>
                        <div className="text-2xl font-bold animate-in fade-in duration-300">{value}</div>
                        {description && <p className="text-xs text-muted-foreground animate-in fade-in duration-300 delay-75">{description}</p>}
                        {trend && <p className="text-xs text-muted-foreground mt-1 animate-in fade-in duration-300 delay-100">{trend}</p>}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

interface StatCardsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
}

export function StatCardsGrid({ children, columns = 4 }: StatCardsGridProps) {
    const colsClass = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4',
        5: 'md:grid-cols-5'
    };

    return <div className={`grid gap-4 ${colsClass[columns]}`}>{children}</div>;
}
