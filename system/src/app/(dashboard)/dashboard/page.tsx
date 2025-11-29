'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, ScanLine, CreditCard, Shield, CheckCircle, XCircle, Clock, TrendingUp, BarChart3, PieChart, Activity, MoreHorizontal, UserX, UserCheck, Ban, Check, Trash2, MapPin, Copy, Mail, Hash, Key, HelpCircle, UserRound, CircleHelp } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { getRelativeTime } from '@/lib/utils/format';
import { PageHeader, StatCard, StatCardsGrid } from '@/components/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeSkeleton } from '@/components/ui/loading-skeletons';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

type TimePeriod = 'all' | 'year' | 'month' | 'week';

interface RecentLog {
  id: string;
  timestamp: string;
  access_granted: boolean | null;
  rfid_uid: string; // RFID UID directly from access_log (always present)
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_is_active: boolean;
  token_id: string | null;
  token_name: string | null;
  token_rfid: string | null;
  token_is_active: boolean;
  scanner_id: string | null;
  scanner_name: string | null;
  scanner_location: string | null;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalScanners: number;
  activeScanners: number;
  totalTokens: number;
  activeTokens: number;
  totalAccessGrants: number;
  recentLogs: RecentLog[];
  accessStats: {
    granted: number;
    denied: number;
    unknown: number;
  };
  topScanners: {
    id: string;
    name: string;
    location: string;
    access_count: number;
  }[];
}

const initialStats: DashboardStats = {
    totalUsers: 0,
    activeUsers: 0,
    totalScanners: 0,
    activeScanners: 0,
    totalTokens: 0,
    activeTokens: 0,
    totalAccessGrants: 0,
    recentLogs: [],
    accessStats: { granted: 0, denied: 0, unknown: 0 },
    topScanners: []
};

// Chart configurations
const accessChartConfig: ChartConfig = {
    granted: { label: 'Granted', color: 'hsl(142, 76%, 36%)' },
    denied: { label: 'Denied', color: 'hsl(0, 84%, 60%)' },
    unknown: { label: 'Unknown', color: 'hsl(45, 93%, 47%)' }
};

const resourcesChartConfig: ChartConfig = {
    active: { label: 'Active', color: 'hsl(142, 76%, 36%)' },
    inactive: { label: 'Inactive', color: 'hsl(220, 14%, 71%)' }
};

const COLORS = {
    granted: 'hsl(142, 76%, 36%)',
    denied: 'hsl(0, 84%, 60%)',
    unknown: 'hsl(45, 93%, 47%)'
};

export default function DashboardPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();
    const [stats, setStats] = useState<DashboardStats>(initialStats);
    const [isLoading, setIsLoading] = useState(true);
    const [logsLimit, setLogsLimit] = useState<number>(10);
    const [chartPeriod, setChartPeriod] = useState<TimePeriod>('month');
    const [resourceFilter, setResourceFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Permissions
    const currentUserRole = currentUser?.role || 'user';
    const canManageUsers = currentUserRole === 'root' || currentUserRole === 'admin';
    const canDeleteUsers = currentUserRole === 'root';
    const canManageTokens = currentUserRole === 'root' || currentUserRole === 'admin';
    const canDeleteTokens = currentUserRole === 'root';

    // Calculate date filter based on period
    const getDateFilter = useCallback((period: TimePeriod): Date | null => {
        const now = new Date();
        switch (period) {
            case 'week':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case 'month':
                return new Date(now.getFullYear(), now.getMonth(), 1);
            case 'year':
                return new Date(now.getFullYear(), 0, 1);
            default:
                return null;
        }
    }, []);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const dateFilter = getDateFilter(chartPeriod);

            // Build access logs query with date filter
            let accessLogsQuery = supabase.from('access_logs').select('access_granted, token_id');
            if (dateFilter) {
                accessLogsQuery = accessLogsQuery.gte('timestamp', dateFilter.toISOString());
            }

            // Build top scanners query
            let topScannersQuery = supabase.from('access_logs').select('scanner_id, scanners:scanner_id (id, name, location)');
            if (dateFilter) {
                topScannersQuery = topScannersQuery.gte('timestamp', dateFilter.toISOString());
            }

            const [usersResult, scannersResult, tokensResult, accessResult, logsResult, accessLogsResult, topScannersResult] = await Promise.all([
                supabase.from('users').select('is_active'),
                supabase.from('scanners').select('is_active'),
                supabase.from('tokens').select('is_active'),
                supabase.from('scanner_access').select('*', { count: 'exact', head: true }),
                supabase
                    .from('access_logs')
                    .select(
                        `
            id, timestamp, access_granted, rfid_uid,
            tokens:token_id (id, name, rfid_uid, is_active, users:user_id (id, full_name, email, is_active)),
            scanners:scanner_id (id, name, location)
          `
                    )
                    .order('timestamp', { ascending: false })
                    .limit(logsLimit),
                accessLogsQuery,
                topScannersQuery
            ]);

            const usersData = usersResult.data || [];
            const scannersData = scannersResult.data || [];
            const tokensData = tokensResult.data || [];
            const accessLogsData = accessLogsResult.data || [];

            // Calculate access stats
            // "Unknown" = token not registered in system (token_id is NULL)
            const accessStats = {
                granted: accessLogsData.filter((log: any) => log.access_granted === true && log.token_id !== null).length,
                denied: accessLogsData.filter((log: any) => log.access_granted === false && log.token_id !== null).length,
                unknown: accessLogsData.filter((log: any) => log.token_id === null).length
            };

            // Calculate top scanners
            const scannerCounts: Record<string, { id: string; name: string; location: string; count: number }> = {};
            (topScannersResult.data || []).forEach((log: any) => {
                if (log.scanners) {
                    const scannerId = log.scanners.id;
                    if (!scannerCounts[scannerId]) {
                        scannerCounts[scannerId] = {
                            id: scannerId,
                            name: log.scanners.name,
                            location: log.scanners.location,
                            count: 0
                        };
                    }
                    scannerCounts[scannerId].count++;
                }
            });

            const topScanners = Object.values(scannerCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
                .map((s) => ({ ...s, access_count: s.count }));

            const recentLogs: RecentLog[] = (logsResult.data || []).map((log: any) => ({
                id: log.id,
                timestamp: log.timestamp,
                access_granted: log.access_granted,
                rfid_uid: log.rfid_uid, // RFID UID directly from access_log
                user_id: log.tokens?.users?.id || null,
                user_name: log.tokens?.users?.full_name || null,
                user_email: log.tokens?.users?.email || null,
                user_is_active: log.tokens?.users?.is_active ?? true,
                token_id: log.tokens?.id || null,
                token_name: log.tokens?.name || null,
                token_rfid: log.tokens?.rfid_uid || null,
                token_is_active: log.tokens?.is_active ?? true,
                scanner_id: log.scanners?.id || null,
                scanner_name: log.scanners?.name || null,
                scanner_location: log.scanners?.location || null
            }));

            setStats({
                totalUsers: usersData.length,
                activeUsers: usersData.filter((u) => u.is_active).length,
                totalScanners: scannersData.length,
                activeScanners: scannersData.filter((d) => d.is_active).length,
                totalTokens: tokensData.length,
                activeTokens: tokensData.filter((t) => t.is_active).length,
                totalAccessGrants: accessResult.count || 0,
                recentLogs,
                accessStats,
                topScanners
            });
        } catch (error) {
            logger.error('Error fetching dashboard stats:', error);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, logsLimit, chartPeriod, getDateFilter]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Action handlers
    const handleToggleUserActive = async (userId: string, currentStatus: boolean) => {
        const { error } = await supabase.from('users').update({ is_active: !currentStatus }).eq('id', userId);
        if (error) {
            toast.error('Failed to update user status');
            return;
        }
        toast.success(`User ${currentStatus ? 'disabled' : 'enabled'}`);
        fetchStats();
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) { return; }
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) {
            toast.error('Failed to delete user');
            return;
        }
        toast.success('User deleted');
        fetchStats();
    };

    const handleToggleTokenActive = async (tokenId: string, currentStatus: boolean) => {
        const { error } = await supabase.from('tokens').update({ is_active: !currentStatus }).eq('id', tokenId);
        if (error) {
            toast.error('Failed to update token status');
            return;
        }
        toast.success(`Token ${currentStatus ? 'disabled' : 'enabled'}`);
        fetchStats();
    };

    const handleDeleteToken = async (tokenId: string) => {
        if (!confirm('Are you sure you want to delete this token?')) { return; }
        const { error } = await supabase.from('tokens').delete().eq('id', tokenId);
        if (error) {
            toast.error('Failed to delete token');
            return;
        }
        toast.success('Token deleted');
        fetchStats();
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    // Prepare chart data - filter out zero values for pie chart to avoid rendering issues
    const accessPieData = useMemo(() => {
        const data = [
            { name: 'Granted', value: stats.accessStats.granted, fill: COLORS.granted },
            { name: 'Denied', value: stats.accessStats.denied, fill: COLORS.denied },
            { name: 'Unknown', value: stats.accessStats.unknown, fill: COLORS.unknown }
        ];
        // Filter out zero values for pie chart (they cause rendering issues)
        return data.filter((item) => item.value > 0);
    }, [stats.accessStats]);

    // Bar chart shows all categories including zeros
    const accessBarData = useMemo(
        () => [
            { name: 'Granted', value: stats.accessStats.granted, fill: COLORS.granted },
            { name: 'Denied', value: stats.accessStats.denied, fill: COLORS.denied },
            { name: 'Unknown', value: stats.accessStats.unknown, fill: COLORS.unknown }
        ],
        [stats.accessStats]
    );

    const resourcesBarData = useMemo(() => {
        const data = [
            {
                name: 'Users',
                active: stats.activeUsers,
                inactive: stats.totalUsers - stats.activeUsers,
                total: stats.totalUsers
            },
            {
                name: 'Scanners',
                active: stats.activeScanners,
                inactive: stats.totalScanners - stats.activeScanners,
                total: stats.totalScanners
            },
            {
                name: 'Tokens',
                active: stats.activeTokens,
                inactive: stats.totalTokens - stats.activeTokens,
                total: stats.totalTokens
            }
        ];

        if (resourceFilter === 'active') {
            return data.map((d) => ({ ...d, inactive: 0 }));
        } if (resourceFilter === 'inactive') {
            return data.map((d) => ({ ...d, active: 0 }));
        }
        return data;
    }, [stats, resourceFilter]);

    const statCards = [
        { title: 'Total Users', value: stats.totalUsers, description: 'Registered users in the system', icon: Users, trend: `${stats.activeUsers} active` },
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

    const periodLabels: Record<TimePeriod, string> = {
        all: 'All Time',
        year: 'This Year',
        month: 'This Month',
        week: 'Last 7 Days'
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Dashboard" description={`Welcome back${currentUser?.full_name ? `, ${currentUser.full_name}` : ''}! Here's an overview of your RFID access management system.`} />

            {/* Statistics Cards */}
            <StatCardsGrid columns={4}>
                {statCards.map((stat) => (
                    <StatCard key={stat.title} title={stat.title} value={stat.value} description={stat.description} icon={stat.icon} trend={stat.trend} isLoading={isLoading} />
                ))}
            </StatCardsGrid>

            {/* Quick Stats & Actions - MOVED UP */}
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

            {/* Charts Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Access Status Bar Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                Access Statistics
                            </CardTitle>
                            <CardDescription>Access attempts breakdown</CardDescription>
                        </div>
                        <Select value={chartPeriod} onValueChange={(v: TimePeriod) => setChartPeriod(v)}>
                            <SelectTrigger className="w-auto">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="week">Last 7 Days</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                                <SelectItem value="year">This Year</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="h-[300px] flex items-center justify-center">
                                <Skeleton className="h-full w-full" />
                            </div>
                        ) : (
                            <ChartContainer config={accessChartConfig} className="h-[300px] w-full">
                                <BarChart data={accessBarData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" />
                                    <YAxis type="category" dataKey="name" width={80} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Access Status Pie Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <PieChart className="h-5 w-5" />
                Access Distribution
                            </CardTitle>
                            <CardDescription>{periodLabels[chartPeriod]}</CardDescription>
                        </div>
                        <Select value={chartPeriod} onValueChange={(v: TimePeriod) => setChartPeriod(v)}>
                            <SelectTrigger className="w-auto">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="week">Last 7 Days</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                                <SelectItem value="year">This Year</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="h-[300px] flex items-center justify-center">
                                <Skeleton className="h-48 w-48 rounded-full" />
                            </div>
                        ) : (
                            <ChartContainer config={accessChartConfig} className="h-[300px] w-full">
                                <RechartsPieChart>
                                    <Pie data={accessPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {accessPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                </RechartsPieChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Resources Chart and Top Scanners */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Resources Bar Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                System Resources
                            </CardTitle>
                            <CardDescription>Users, Scanners, and Tokens</CardDescription>
                        </div>
                        <Select value={resourceFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setResourceFilter(v)}>
                            <SelectTrigger className="w-auto">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active Only</SelectItem>
                                <SelectItem value="inactive">Inactive Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="h-[300px] flex items-center justify-center">
                                <Skeleton className="h-full w-full" />
                            </div>
                        ) : (
                            <ChartContainer config={resourcesChartConfig} className="h-[300px] w-full">
                                <BarChart data={resourcesBarData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar dataKey="active" stackId="a" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="inactive" stackId="a" fill="hsl(220, 14%, 71%)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Top Scanners */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ScanLine className="h-5 w-5" />
              Top 10 Scanners
                        </CardTitle>
                        <CardDescription>Most frequently used access points ({periodLabels[chartPeriod]})</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                ))}
                            </div>
                        ) : stats.topScanners.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No scanner activity in this period</div>
                        ) : (
                            <div className="space-y-3">
                                {stats.topScanners.map((scanner, index) => (
                                    <div key={scanner.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-muted-foreground w-6">#{index + 1}</span>
                                            <div>
                                                <p className="font-medium text-sm">{scanner.name}</p>
                                                <p className="text-xs text-muted-foreground">{scanner.location}</p>
                                            </div>
                                        </div>
                                        <Badge variant="secondary">{scanner.access_count} accesses</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Access Logs - Enhanced */}
            <Card className="transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>Recent Access Logs</CardTitle>
                        <CardDescription>Latest access attempts across all scanners</CardDescription>
                    </div>
                    <Select value={logsLimit.toString()} onValueChange={(v) => setLogsLimit(parseInt(v))}>
                        <SelectTrigger className="w-auto">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">Show 10</SelectItem>
                            <SelectItem value="20">Show 20</SelectItem>
                            <SelectItem value="50">Show 50</SelectItem>
                            <SelectItem value="100">Show 100</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <LogsLoadingSkeleton />
                    ) : stats.recentLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground animate-in fade-in duration-300">No access logs yet. Activity will appear here once users start using their tokens.</div>
                    ) : (
                        <div className="space-y-4">
                            {stats.recentLogs.map((log, index) => (
                                <LogEntryCard key={log.id} log={log} index={index} canManageUsers={canManageUsers} canDeleteUsers={canDeleteUsers} canManageTokens={canManageTokens} canDeleteTokens={canDeleteTokens} onToggleUserActive={handleToggleUserActive} onDeleteUser={handleDeleteUser} onToggleTokenActive={handleToggleTokenActive} onDeleteToken={handleDeleteToken} onCopy={copyToClipboard} />
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
                <div key={i} className="rounded-xl border bg-card p-5 animate-pulse">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-4 w-56" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <Skeleton className="h-20 rounded-lg" />
                        <Skeleton className="h-20 rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    );
}

interface LogEntryCardProps {
  log: RecentLog;
  index: number;
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  canManageTokens: boolean;
  canDeleteTokens: boolean;
  onToggleUserActive: (userId: string, currentStatus: boolean) => void;
  onDeleteUser: (userId: string) => void;
  onToggleTokenActive: (tokenId: string, currentStatus: boolean) => void;
  onDeleteToken: (tokenId: string) => void;
  onCopy: (text: string, label: string) => void;
}

function LogEntryCard({ log, index, canManageUsers, canDeleteUsers, canManageTokens, canDeleteTokens, onToggleUserActive, onDeleteUser, onToggleTokenActive, onDeleteToken, onCopy }: LogEntryCardProps) {
    // Determine status based on token_id (Unknown = unregistered token)
    const getStatusConfig = (log: RecentLog) => {
    // Unknown = token not registered in system (token_id is NULL)
        if (log.token_id === null) {
            return { color: 'bg-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-950/20', borderColor: 'border-amber-200 dark:border-amber-800', text: 'Unknown', textColor: 'text-amber-700 dark:text-amber-400', icon: HelpCircle };
        }
        if (log.access_granted === true) {
            return { color: 'bg-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20', borderColor: 'border-emerald-200 dark:border-emerald-800', text: 'Granted', textColor: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle };
        }
        // access_granted === false (registered token but access denied)
        return { color: 'bg-red-500', bgColor: 'bg-red-50 dark:bg-red-950/20', borderColor: 'border-red-200 dark:border-red-800', text: 'Denied', textColor: 'text-red-700 dark:text-red-400', icon: XCircle };
    };

    const status = getStatusConfig(log);
    const StatusIcon = status.icon;
    const hasUserActions = log.user_id && (canManageUsers || canDeleteUsers);
    const hasTokenActions = log.token_id && (canManageTokens || canDeleteTokens);
    const hasAnyActions = hasUserActions || hasTokenActions;

    return (
        <div className={`rounded-lg border-2 ${status.borderColor} ${status.bgColor} p-4 transition-all duration-200 hover:shadow-sm`} style={{ animationDelay: `${index * 30}ms` }}>
            {/* Main content row */}
            <div className="flex items-center gap-4">
                {/* Status icon */}
                <div className={`h-10 w-10 rounded-full ${status.color} flex items-center justify-center shrink-0`}>
                    <StatusIcon className="h-5 w-5 text-white" />
                </div>

                {/* Info columns */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* User column */}
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="h-3 w-3" />
              User
                        </div>
                        <div className={`font-medium text-sm truncate ${!log.user_id ? 'text-amber-600 dark:text-amber-400' : ''}`}>{log.user_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground truncate">{log.user_email || '—'}</div>
                        {!log.user_is_active && log.user_id && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Disabled
                            </Badge>
                        )}
                    </div>

                    {/* Token column */}
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <CreditCard className="h-3 w-3" />
              Token
                        </div>
                        <div className={`font-medium text-sm truncate ${!log.token_id ? 'text-amber-600 dark:text-amber-400' : ''}`}>{log.token_name || (log.token_id ? 'Unknown' : 'Unregistered')}</div>
                        {/* Always show RFID UID from log (always present) */}
                        <div className="flex items-center gap-1">
                            <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono truncate max-w-[100px]">{log.rfid_uid}</code>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onCopy(log.rfid_uid, 'RFID')}>
                                <Copy className="h-2.5 w-2.5" />
                            </Button>
                        </div>
                        {!log.token_is_active && log.token_id && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Disabled
                            </Badge>
                        )}
                    </div>

                    {/* Scanner column */}
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <ScanLine className="h-3 w-3" />
              Scanner
                        </div>
                        <div className="font-medium text-sm truncate">{log.scanner_name || 'Unknown'}</div>
                        {log.scanner_location ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{log.scanner_location}</span>
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">—</div>
                        )}
                    </div>

                    {/* Status & Time column */}
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
              Status
                        </div>
                        <Badge variant="outline" className={`${status.textColor} text-xs`}>
                            {status.text}
                        </Badge>
                        <div className="text-xs text-muted-foreground">{getRelativeTime(new Date(log.timestamp))}</div>
                    </div>
                </div>

                {/* Actions */}
                {hasAnyActions ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {hasUserActions && (
                                <>
                                    <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                    User Actions
                                    </DropdownMenuItem>
                                    {canManageUsers && (
                                        <DropdownMenuItem onClick={() => onToggleUserActive(log.user_id!, log.user_is_active)}>
                                            {log.user_is_active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                            {log.user_is_active ? 'Disable User' : 'Enable User'}
                                        </DropdownMenuItem>
                                    )}
                                    {canDeleteUsers && (
                                        <DropdownMenuItem onClick={() => onDeleteUser(log.user_id!)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                      Delete User
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                            {hasUserActions && hasTokenActions && <DropdownMenuSeparator />}
                            {hasTokenActions && (
                                <>
                                    <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                    Token Actions
                                    </DropdownMenuItem>
                                    {canManageTokens && (
                                        <DropdownMenuItem onClick={() => onToggleTokenActive(log.token_id!, log.token_is_active)}>
                                            {log.token_is_active ? <Ban className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                                            {log.token_is_active ? 'Disable Token' : 'Enable Token'}
                                        </DropdownMenuItem>
                                    )}
                                    {canDeleteTokens && (
                                        <DropdownMenuItem onClick={() => onDeleteToken(log.token_id!)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                      Delete Token
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <div className="w-8" /> // Placeholder to keep alignment
                )}
            </div>
        </div>
    );
}
