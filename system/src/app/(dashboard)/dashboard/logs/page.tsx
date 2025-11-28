'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, CreditCard, Download, FileText, Filter, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { formatTimestamp, getDateFilterRange } from '@/lib/utils/format';
import { PageHeader, StatCard, StatCardsGrid, FormDialog } from '@/components/dashboard';
import { SimpleTable } from '@/components/dashboard/data-table';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import type { AccessLog, Scanner, User } from '@/types/database';
import type { Column } from '@/components/dashboard/data-table';

interface ExtendedAccessLog extends AccessLog {
  user_name?: string;
  scanner_name?: string;
  token_name?: string;
  user_id?: string;
}

interface TokenForm {
  name: string;
  user_id: string;
}

export default function LogsPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();

    const [logs, setLogs] = useState<ExtendedAccessLog[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [scanners, setScanners] = useState<Scanner[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [scannerFilter, setScannerFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');

    // Register token dialog
    const registerDialog = useDialog<string>();
    const tokenForm = useForm<TokenForm>({ name: '', user_id: '' });
    const { isSubmitting, submit } = useSubmit();

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: logsData, error: logsError } = await supabase
                .from('access_logs')
                .select(
                    `
          *,
          tokens:token_id (id, name, user_id, users:user_id (id, full_name, email)),
          scanners:scanner_id (id, name)
        `
                )
                .order('timestamp', { ascending: false })
                .limit(500);

            if (logsError) {
                logger.error('Error fetching logs:', logsError);
                const { data: basicLogs } = await supabase.from('access_logs').select('*').order('timestamp', { ascending: false }).limit(500);
                setLogs(basicLogs || []);
            } else {
                const transformedLogs = (logsData || []).map((log: any) => ({
                    ...log,
                    user_name: log.tokens?.users?.full_name || log.tokens?.users?.email,
                    user_id: log.tokens?.user_id,
                    scanner_name: log.scanners?.name,
                    token_name: log.tokens?.name
                }));
                setLogs(transformedLogs);
            }

            const { data: usersData } = await supabase.from('users').select('*').order('full_name');
            setUsers(usersData || []);

            const { data: scannersData } = await supabase.from('scanners').select('*').order('name');
            setScanners(scannersData || []);
        } catch (error) {
            logger.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Permissions
    const currentUserRole = currentUser?.role || 'user';
    const canExport = currentUserRole === 'root';
    const canRegisterTokens = currentUserRole === 'root' || currentUserRole === 'admin';

    // Unique values for filters
    const uniqueScanners = useMemo(() => [...new Set(logs.map((log) => log.scanner_name))].filter(Boolean), [logs]);

    // Filter logs
    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            const matchesSearch = !searchQuery || log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) || log.rfid_uid.toLowerCase().includes(searchQuery.toLowerCase()) || log.scanner_name?.toLowerCase().includes(searchQuery.toLowerCase()) || log.token_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'all' || (statusFilter === 'granted' && log.access_granted) || (statusFilter === 'denied' && !log.access_granted);

            const matchesScanner = scannerFilter === 'all' || log.scanner_name === scannerFilter;

            const dateRange = getDateFilterRange(dateFilter);
            const matchesDate = !dateRange || new Date(log.timestamp) >= dateRange;

            return matchesSearch && matchesStatus && matchesScanner && matchesDate;
        });
    }, [logs, searchQuery, statusFilter, scannerFilter, dateFilter]);

    // Statistics
    const stats = useMemo(
        () => ({
            total: filteredLogs.length,
            granted: filteredLogs.filter((l) => l.access_granted).length,
            denied: filteredLogs.filter((l) => !l.access_granted).length,
            unknown: filteredLogs.filter((l) => !l.token_id || !l.user_name)
        }),
        [filteredLogs]
    );

    // Handlers
    const handleExport = () => {
        const csvContent = [['Timestamp', 'User', 'Scanner', 'Token', 'RFID UID', 'Status', 'Denial Reason'].join(','), ...filteredLogs.map((log) => [log.timestamp, log.user_name || 'Unknown', log.scanner_name || 'Unknown', log.token_name || 'Unknown', log.rfid_uid, log.access_granted ? 'Granted' : 'Denied', log.denial_reason || ''].join(','))].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `access-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        toast.success('Export completed', { description: `Exported ${filteredLogs.length} log entries` });
    };

    const handleRegisterToken = async () => {
        if (!tokenForm.form.name || !tokenForm.form.user_id) {
            toast.error('Please fill in all fields');
            return;
        }

        const success = await submit(async () => {
            const { error } = await supabase.from('tokens').insert({
                rfid_uid: registerDialog.selectedItem,
                name: tokenForm.form.name,
                user_id: tokenForm.form.user_id,
                is_active: true
            });

            if (error) {
                toast.error('Failed to register token', { description: error.message });
                return false;
            }

            toast.success('Token registered successfully');
            await fetchData();
            return true;
        });

        if (success) {
            registerDialog.close();
            tokenForm.reset();
        }
    };

    const openRegisterDialog = (rfidUid: string) => {
        tokenForm.reset({ name: '', user_id: '' });
        registerDialog.open(rfidUid);
    };

    // Table columns
    const logColumns: Column<ExtendedAccessLog>[] = [
        {
            key: 'timestamp',
            header: 'Timestamp',
            render: (log) => {
                const { date, time } = formatTimestamp(log.timestamp);
                return (
                    <div>
                        <p className="font-medium">{time}</p>
                        <p className="text-xs text-muted-foreground">{date}</p>
                    </div>
                );
            }
        },
        {
            key: 'user',
            header: 'User',
            render: (log) => log.user_name || <span className="text-muted-foreground italic">Unknown</span>
        },
        { key: 'scanner', header: 'Scanner', render: (log) => log.scanner_name || 'Unknown' },
        {
            key: 'token',
            header: 'Token',
            render: (log) => log.token_name || <span className="text-muted-foreground italic">Unregistered</span>
        },
        { key: 'rfid', header: 'RFID UID', className: 'font-mono text-sm', render: (log) => log.rfid_uid },
        {
            key: 'status',
            header: 'Status',
            render: (log) => (
                <Badge variant={log.access_granted ? 'default' : 'destructive'} className={log.access_granted ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                    {log.access_granted ? (
                        <>
                            <CheckCircle className="mr-1 h-3 w-3" />
              Granted
                        </>
                    ) : (
                        <>
                            <XCircle className="mr-1 h-3 w-3" />
              Denied
                        </>
                    )}
                </Badge>
            )
        }
    ];

    // Unknown tokens grouped
    const unknownByUid = useMemo(() => {
        const grouped: Record<string, { rfid_uid: string; attempts: number; lastAttempt: string; scanners: Set<string> }> = {};

        stats.unknown.forEach((log) => {
            if (!grouped[log.rfid_uid]) {
                grouped[log.rfid_uid] = { rfid_uid: log.rfid_uid, attempts: 0, lastAttempt: log.timestamp, scanners: new Set() };
            }
            grouped[log.rfid_uid].attempts++;
            if (log.scanner_name) {
                grouped[log.rfid_uid].scanners.add(log.scanner_name);
            }
            if (new Date(log.timestamp) > new Date(grouped[log.rfid_uid].lastAttempt)) {
                grouped[log.rfid_uid].lastAttempt = log.timestamp;
            }
        });

        return Object.values(grouped).sort((a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime());
    }, [stats.unknown]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="System Logs"
                description="View and analyze access attempt history"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
                        </Button>
                        {canExport && (
                            <Button onClick={handleExport} variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                Export CSV
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Statistics */}
            <StatCardsGrid columns={5}>
                <StatCard title="Total Logs" value={stats.total} description="Filtered results" icon={FileText} />
                <StatCard title="Granted" value={stats.granted} description={`${stats.total > 0 ? ((stats.granted / stats.total) * 100).toFixed(1) : 0}% success rate`} icon={CheckCircle} iconClassName="text-green-500" />
                <StatCard title="Denied" value={stats.denied} description="Failed attempts" icon={XCircle} iconClassName="text-red-500" />
                <StatCard title="Unknown Tokens" value={stats.unknown.length} description="Unregistered cards" icon={AlertTriangle} iconClassName="text-yellow-500" />
                <StatCard title="Last Activity" value={logs[0] ? formatTimestamp(logs[0].timestamp).relative : '—'} description={logs[0] ? formatTimestamp(logs[0].timestamp).date : 'No activity'} icon={Clock} />
            </StatCardsGrid>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
            Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input placeholder="Search by user, RFID UID, scanner, or token..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                        <div className={'inline-flex gap-4 flex-wrap'}>
                            <FilterSelect
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={[
                                    { value: 'all', label: 'All Status' },
                                    { value: 'granted', label: 'Granted' },
                                    { value: 'denied', label: 'Denied' }
                                ]}
                            />
                            <FilterSelect value={scannerFilter} onChange={setScannerFilter} options={[{ value: 'all', label: 'All Scanners' }, ...uniqueScanners.map((s) => ({ value: s!, label: s! }))]} />
                            <FilterSelect
                                value={dateFilter}
                                onChange={setDateFilter}
                                options={[
                                    { value: 'all', label: 'All Time' },
                                    { value: 'today', label: 'Today' },
                                    { value: 'week', label: 'Last 7 Days' },
                                    { value: 'month', label: 'Last 30 Days' },
                                    { value: 'year', label: 'Last Year' }
                                ]}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="all" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="all">All Logs</TabsTrigger>
                    <TabsTrigger value="denied">Denied Only</TabsTrigger>
                    <TabsTrigger value="unknown">Unknown Tokens</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                    <Card>
                        <CardHeader>
                            <CardTitle>Access History</CardTitle>
                            <CardDescription>
                Showing {Math.min(filteredLogs.length, 100)} of {logs.length} logs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <TableSkeleton columns={7} rows={10} />
                            ) : (
                                <>
                                    <SimpleTable
                                        columns={[
                                            ...logColumns,
                                            {
                                                key: 'action',
                                                header: '',
                                                className: 'w-[70px]',
                                                render: (log) =>
                                                    (!log.token_id || !log.user_name) && canRegisterTokens ? (
                                                        <Button variant="ghost" size="sm" onClick={() => openRegisterDialog(log.rfid_uid)}>
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    ) : null
                                            }
                                        ]}
                                        data={filteredLogs.slice(0, 100)}
                                        keyExtractor={(log) => log.id}
                                    />
                                    {filteredLogs.length > 100 && <p className="text-center text-sm text-muted-foreground mt-4">Showing first 100 results. Use filters to narrow down.</p>}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="denied">
                    <Card>
                        <CardHeader>
                            <CardTitle>Denied Access Attempts</CardTitle>
                            <CardDescription>{filteredLogs.filter((l) => !l.access_granted).length} denied attempts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SimpleTable
                                columns={[
                                    logColumns[0], // timestamp
                                    logColumns[1], // user
                                    logColumns[2], // door
                                    { key: 'rfid', header: 'RFID UID', className: 'font-mono text-sm', render: (log) => log.rfid_uid },
                                    {
                                        key: 'reason',
                                        header: 'Reason',
                                        render: (log) => {
                                            const isUnknown = !log.token_id || !log.user_name;
                                            return <Badge variant="outline">{log.denial_reason || (isUnknown ? 'Unknown token' : 'No access')}</Badge>;
                                        }
                                    },
                                    {
                                        key: 'action',
                                        header: '',
                                        className: 'w-[70px]',
                                        render: (log) =>
                                            (!log.token_id || !log.user_name) && canRegisterTokens ? (
                                                <Button variant="ghost" size="sm" onClick={() => openRegisterDialog(log.rfid_uid)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            ) : null
                                    }
                                ]}
                                data={filteredLogs.filter((l) => !l.access_granted).slice(0, 50)}
                                keyExtractor={(log) => log.id}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="unknown">
                    <Card>
                        <CardHeader>
                            <CardTitle>Unknown Token Attempts</CardTitle>
                            <CardDescription>Unregistered RFID cards that attempted access. Click + to register a token.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SimpleTable
                                columns={[
                                    { key: 'rfid', header: 'RFID UID', className: 'font-mono font-medium', render: (item) => item.rfid_uid },
                                    { key: 'attempts', header: 'Attempts', render: (item) => <Badge variant="secondary">{item.attempts}</Badge> },
                                    { key: 'scanners', header: 'Scanners Tried', render: (item) => Array.from(item.scanners).join(', ') || '—' },
                                    { key: 'last', header: 'Last Attempt', render: (item) => formatTimestamp(item.lastAttempt).relative },
                                    {
                                        key: 'action',
                                        header: 'Action',
                                        className: 'w-[100px]',
                                        render: (item) =>
                                            canRegisterTokens ? (
                                                <Button variant="outline" size="sm" onClick={() => openRegisterDialog(item.rfid_uid)}>
                                                    <CreditCard className="mr-2 h-4 w-4" />
                          Register
                                                </Button>
                                            ) : null
                                    }
                                ]}
                                data={unknownByUid}
                                keyExtractor={(item) => item.rfid_uid}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Register Token Dialog */}
            <FormDialog
                open={registerDialog.isOpen}
                onOpenChange={(open) => !open && registerDialog.close()}
                title="Register New Token"
                description={
                    <>
            Register the RFID card with UID: <code className="font-mono bg-muted px-1 rounded">{registerDialog.selectedItem}</code>
                    </>
                }
                onSubmit={handleRegisterToken}
                submitLabel="Register Token"
                submitLoadingLabel="Registering..."
                isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="token_name">Token Name</Label>
                    <Input id="token_name" placeholder="e.g., Main Card, Keychain" value={tokenForm.form.name} onChange={(e) => tokenForm.updateField('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="token_user">Assign to User</Label>
                    <Select value={tokenForm.form.user_id} onValueChange={(v) => tokenForm.updateField('user_id', v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.full_name || user.email}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </FormDialog>
        </div>
    );
}

// Helper component
function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue />
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
}
