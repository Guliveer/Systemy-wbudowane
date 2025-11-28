'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ScanLine, CreditCard, Shield, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { getRelativeTime } from '@/lib/utils/format';
import { PageHeader, StatCard, StatCardsGrid } from '@/components/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { ListSkeleton, BadgeSkeleton } from '@/components/ui/loading-skeletons';

interface DashboardStats {
  totalUsers: number;
  totalScanners: number;
  activeScanners: number;
  totalTokens: number;
  activeTokens: number;
  totalAccessGrants: number;
  recentLogs: {
    id: string;
    user_name: string | null;
    scanner_name: string | null;
    timestamp: string;
    access_granted: boolean;
  }[];
}

const initialStats: DashboardStats = {
    totalUsers: 0,
    totalScanners: 0,
    activeScanners: 0,
    totalTokens: 0,
    activeTokens: 0,
    totalAccessGrants: 0,
    recentLogs: []
};

export default function DashboardPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();
    const [stats, setStats] = useState<DashboardStats>(initialStats);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersResult, scannersResult, tokensResult, accessResult, logsResult] = await Promise.all([
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('scanners').select('is_active'),
                supabase.from('tokens').select('is_active'),
                supabase.from('scanner_access').select('*', { count: 'exact', head: true }),
                supabase
                    .from('access_logs')
                    .select(
                        `
            id, timestamp, access_granted,
            tokens:token_id (users:user_id (full_name, email)),
            scanners:scanner_id (name)
          `
                    )
                    .order('timestamp', { ascending: false })
                    .limit(10)
            ]);

            const scannersData = scannersResult.data || [];
            const tokensData = tokensResult.data || [];
            const recentLogs = (logsResult.data || []).map((log: any) => ({
                id: log.id,
                user_name: log.tokens?.users?.full_name || log.tokens?.users?.email || 'Unknown',
                scanner_name: log.scanners?.name || 'Unknown',
                timestamp: log.timestamp,
                access_granted: log.access_granted
            }));

            setStats({
                totalUsers: usersResult.count || 0,
                totalScanners: scannersData.length,
                activeScanners: scannersData.filter((d) => d.is_active).length,
                totalTokens: tokensData.length,
                activeTokens: tokensData.filter((t) => t.is_active).length,
                totalAccessGrants: accessResult.count || 0,
                recentLogs
            });
        } catch (error) {
            logger.error('Error fetching dashboard stats:', error);
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const statCards = [
        { title: 'Total Users', value: stats.totalUsers, description: 'Registered users in the system', icon: Users, trend: `${stats.totalUsers} active` },
        { title: 'Scanners', value: stats.totalScanners, description: 'Configured access points', icon: ScanLine, trend: `${stats.activeScanners} active` },
        { title: 'Active Tokens', value: stats.activeTokens, description: 'RFID tokens registered', icon: CreditCard, trend: `${stats.totalTokens} total` },
        { title: 'Access Grants', value: stats.totalAccessGrants, description: 'Active access permissions', icon: Shield, trend: 'User-scanner mappings' }
    ];

    const quickActions = [
        { href: '/dashboard/users', icon: Users, label: 'Manage Users' },
        { href: '/dashboard/tokens', icon: CreditCard, label: 'Manage Tokens' },
        { href: '/dashboard/access', icon: Shield, label: 'Access Control' },
        { href: '/dashboard/logs', icon: Clock, label: 'View Logs' }
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Dashboard" description={`Welcome back${currentUser?.full_name ? `, ${currentUser.full_name}` : ''}! Here's an overview of your RFID access management system.`} />

            {/* Statistics Cards */}
            <StatCardsGrid columns={4}>
                {statCards.map((stat) => (
                    <StatCard key={stat.title} title={stat.title} value={stat.value} description={stat.description} icon={stat.icon} trend={stat.trend} isLoading={isLoading} />
                ))}
            </StatCardsGrid>

            {/* Quick Stats & Actions */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
              System Status
                        </CardTitle>
                        <CardDescription>Current system health and activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <StatusRow label="Active Scanners" value={`${stats.activeScanners} / ${stats.totalScanners}`} isGood={stats.activeScanners === stats.totalScanners} />
                            <StatusRow label="Active Tokens" value={`${stats.activeTokens} / ${stats.totalTokens}`} isGood={stats.activeTokens > 0} />
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Your Role</span>
                                {currentUser?.role ? (
                                    <Badge variant={currentUser?.role === 'root' ? 'destructive' : 'default'} className="animate-in fade-in duration-300">
                                        {currentUser.role}
                                    </Badge>
                                ) : (
                                    <BadgeSkeleton />
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Last Activity</span>
                                <span className="text-sm text-muted-foreground">{stats.recentLogs[0] ? getRelativeTime(new Date(stats.recentLogs[0].timestamp)) : 'No activity'}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
              Quick Actions
                        </CardTitle>
                        <CardDescription>Common tasks and shortcuts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                            {quickActions.map((action) => (
                                <a key={action.href} href={action.href} className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors">
                                    <action.icon className="h-4 w-4" />
                                    <span className="text-sm">{action.label}</span>
                                </a>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Access Logs */}
            <Card className="transition-all duration-200">
                <CardHeader>
                    <CardTitle>Recent Access Logs</CardTitle>
                    <CardDescription>Latest access attempts across all scanners</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <LogsLoadingSkeleton />
                    ) : stats.recentLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground animate-in fade-in duration-300">No access logs yet. Activity will appear here once users start using their tokens.</div>
                    ) : (
                        <div className="space-y-4">
                            {stats.recentLogs.map((log, index) => (
                                <LogEntry key={log.id} log={log} index={index} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Helper components
function StatusRow({ label, value, isGood }: { label: string; value: string; isGood: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <Badge variant={isGood ? 'default' : 'secondary'} className="animate-in fade-in duration-300">
                {value}
            </Badge>
        </div>
    );
}

function LogsLoadingSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 animate-pulse">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                    <div className="text-right space-y-2">
                        <Skeleton className="h-4 w-16 ml-auto" />
                        <Skeleton className="h-3 w-20 ml-auto" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function LogEntry({ log, index }: { log: DashboardStats['recentLogs'][0]; index: number }) {
    return (
        <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex items-center gap-4">
                <div className={`h-2 w-2 rounded-full ${log.access_granted ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <div>
                    <p className="font-medium">{log.user_name}</p>
                    <p className="text-sm text-muted-foreground">{log.scanner_name}</p>
                </div>
            </div>
            <div className="text-right">
                <p className={`text-sm font-medium ${log.access_granted ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="flex items-center gap-1">
                        {log.access_granted ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {log.access_granted ? 'Granted' : 'Denied'}
                    </span>
                </p>
                <p className="text-xs text-muted-foreground">{getRelativeTime(new Date(log.timestamp))}</p>
            </div>
        </div>
    );
}
