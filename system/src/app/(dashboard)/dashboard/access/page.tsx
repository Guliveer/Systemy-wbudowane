'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield, Users, ScanLine, RefreshCw, Search, X, User as UserIcon, Pencil, Filter, ArrowUpDown, ArrowUp, ArrowDown, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { isExpired, formatExpiry } from '@/lib/utils/format';
import { PageHeader, StatCard, StatCardsGrid, DataTable, FormDialog, ConfirmDialog } from '@/components/dashboard';
import { ListSkeleton } from '@/components/ui/loading-skeletons';
import { useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import type { ScannerAccess, User, Scanner } from '@/types/database';
import type { Column, Action } from '@/components/dashboard/data-table';

interface ExtendedScannerAccess extends ScannerAccess {
  user_name?: string;
  user_email?: string;
  scanner_name?: string;
  scanner_location?: string;
  granted_by_name?: string;
}

// Helper function to get status badge variant
const getAccessStatusBadgeVariant = (isActive: boolean, isExpired: boolean): 'default' | 'secondary' | 'destructive' => {
    if (isExpired) { return 'destructive'; }
    if (!isActive) { return 'secondary'; }
    return 'default';
};

const getAccessStatusLabel = (isActive: boolean, isExpired: boolean): string => {
    if (isExpired) { return 'Expired'; }
    if (!isActive) { return 'Disabled'; }
    return 'Active';
};

interface AccessForm {
  user_id: string;
  scanner_id: string;
  expires_at: string;
  is_permanent: boolean;
}

const initialForm: AccessForm = { user_id: '', scanner_id: '', expires_at: '', is_permanent: true };

type SortField = 'id' | 'user_name' | 'scanner_name' | 'granted_by_name' | 'created_at' | 'expires_at';
type SortDirection = 'asc' | 'desc';

// Copy to clipboard component
function CopyableId({ id }: { id: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            toast.success('ID skopiowane do schowka');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Nie udało się skopiować ID');
        }
    };

    return (
        <div className="inline-flex items-center gap-1">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{id}</code>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
        </div>
    );
}

// User search select component
function UserSearchSelect({ users, value, onChange }: { users: User[]; value: string; onChange: (v: string) => void }) {
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedUser = users.find((u) => u.id === value);

    const filteredUsers = useMemo(() => {
        if (!userSearchQuery) {
            return users.slice(0, 50);
        }
        const query = userSearchQuery.toLowerCase();
        return users.filter((user) => user.full_name?.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)).slice(0, 50);
    }, [userSearchQuery, users]);

    const handleSelect = (userId: string) => {
        onChange(userId);
        setIsOpen(false);
        setUserSearchQuery('');
    };

    const handleClear = () => {
        onChange('');
        setUserSearchQuery('');
    };

    return (
        <div className="relative">
            {value && selectedUser && !isOpen ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-background">
                    <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedUser.full_name || selectedUser.email}</span>
                        {selectedUser.role && (
                            <Badge variant="secondary" className="text-xs">
                                {selectedUser.role}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsOpen(true)}>
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
                    <Input
                        placeholder="Search users by name or email..."
                        value={userSearchQuery}
                        onChange={(e) => {
                            setUserSearchQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        className="pl-10"
                    />
                </div>
            )}

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                    {filteredUsers.length === 0 ? (
                        <div className="px-3 py-6 text-center text-muted-foreground">{userSearchQuery ? 'No users found' : 'Start typing to search users'}</div>
                    ) : (
                        <>
                            {filteredUsers.map((user) => (
                                <button key={user.id} type="button" className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between" onClick={() => handleSelect(user.id)}>
                                    <div>
                                        <p className="font-medium">{user.full_name || user.email}</p>
                                        {user.full_name && <p className="text-xs text-muted-foreground">{user.email}</p>}
                                    </div>
                                    {user.role && (
                                        <Badge variant="secondary" className="text-xs">
                                            {user.role}
                                        </Badge>
                                    )}
                                </button>
                            ))}
                            {users.length > 50 && !userSearchQuery && <div className="px-3 py-2 text-xs text-muted-foreground border-t">Showing first 50 users. Type to search for more.</div>}
                        </>
                    )}
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                        setIsOpen(false);
                        setUserSearchQuery('');
                    }}
                />
            )}
        </div>
    );
}

// Scanner search select component
function ScannerSearchSelect({ scanners, value, onChange }: { scanners: Scanner[]; value: string; onChange: (v: string) => void }) {
    const [scannerSearchQuery, setScannerSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedScanner = scanners.find((d) => d.id === value);

    const filteredScanners = useMemo(() => {
        if (!scannerSearchQuery) {
            return scanners.slice(0, 50);
        }
        const query = scannerSearchQuery.toLowerCase();
        return scanners.filter((scanner) => scanner.name.toLowerCase().includes(query) || scanner.location.toLowerCase().includes(query)).slice(0, 50);
    }, [scannerSearchQuery, scanners]);

    const handleSelect = (scannerId: string) => {
        onChange(scannerId);
        setIsOpen(false);
        setScannerSearchQuery('');
    };

    const handleClear = () => {
        onChange('');
        setScannerSearchQuery('');
    };

    return (
        <div className="relative">
            {value && selectedScanner && !isOpen ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-background">
                    <div className="flex items-center gap-2">
                        <ScanLine className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedScanner.name}</span>
                        <span className="text-xs text-muted-foreground">({selectedScanner.location})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsOpen(true)}>
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
                    <Input
                        placeholder="Search scanners by name or location..."
                        value={scannerSearchQuery}
                        onChange={(e) => {
                            setScannerSearchQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        className="pl-10"
                    />
                </div>
            )}

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                    {filteredScanners.length === 0 ? (
                        <div className="px-3 py-6 text-center text-muted-foreground">{scannerSearchQuery ? 'No scanners found' : 'Start typing to search scanners'}</div>
                    ) : (
                        <>
                            {filteredScanners.map((scanner) => (
                                <button key={scanner.id} type="button" className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between" onClick={() => handleSelect(scanner.id)}>
                                    <div>
                                        <p className="font-medium">{scanner.name}</p>
                                        <p className="text-xs text-muted-foreground">{scanner.location}</p>
                                    </div>
                                </button>
                            ))}
                            {scanners.length > 50 && !scannerSearchQuery && <div className="px-3 py-2 text-xs text-muted-foreground border-t">Showing first 50 scanners. Type to search for more.</div>}
                        </>
                    )}
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                        setIsOpen(false);
                        setScannerSearchQuery('');
                    }}
                />
            )}
        </div>
    );
}

export default function AccessPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();

    const [accessList, setAccessList] = useState<ExtendedScannerAccess[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [scanners, setScanners] = useState<Scanner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'expired'>('all');
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const grantDialog = useDialog<ExtendedScannerAccess>();
    const editDialog = useDialog<ExtendedScannerAccess>();
    const revokeDialog = useDialog<ExtendedScannerAccess>();
    const toggleActiveDialog = useDialog<ExtendedScannerAccess>();
    const grantForm = useForm<AccessForm>(initialForm);
    const editForm = useForm<{ expires_at: string; is_permanent: boolean }>({ expires_at: '', is_permanent: true });
    const { isSubmitting, submit } = useSubmit();

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: accessData, error: accessError } = await supabase
                .from('scanner_access')
                .select(
                    `
          *,
          users:user_id (id, full_name, email),
          scanners:scanner_id (id, name, location),
          granted_by_user:granted_by (id, full_name, email)
        `
                )
                .order('created_at', { ascending: false });

            if (accessError) {
                logger.error('Error fetching access:', accessError);
                toast.error('Failed to fetch access data');
            } else {
                const transformedAccess = (accessData || []).map((access: any) => ({
                    ...access,
                    user_name: access.users?.full_name || access.users?.email,
                    user_email: access.users?.email,
                    scanner_name: access.scanners?.name,
                    scanner_location: access.scanners?.location,
                    granted_by_name: access.granted_by_user?.full_name || access.granted_by_user?.email
                }));
                setAccessList(transformedAccess);
            }

            const { data: usersData } = await supabase.from('users').select('*').order('full_name');
            setUsers(usersData || []);

            const { data: scannersData } = await supabase.from('scanners').select('*').eq('is_active', true).order('name');
            setScanners(scannersData || []);
        } catch (error) {
            logger.error('Error fetching data:', error);
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Permissions
    const currentUserRole = currentUser?.role || 'user';
    const canGrantAccess = currentUserRole === 'root' || currentUserRole === 'admin';
    const canRevokeAccess = currentUserRole === 'root' || currentUserRole === 'admin';

    // Filter and sort access list
    const filteredAndSortedAccess = useMemo(() => {
    // First filter
        const filtered = accessList.filter((access) => {
            // Status filter
            const expired = isExpired(access.expires_at);
            if (statusFilter === 'active' && (expired || !access.is_active)) {
                return false;
            }
            if (statusFilter === 'disabled' && (access.is_active || expired)) {
                return false;
            }
            if (statusFilter === 'expired' && !expired) {
                return false;
            }

            // Search query filter
            if (!searchQuery) {
                return true;
            }
            const query = searchQuery.toLowerCase();
            return access.id.toLowerCase().includes(query) || access.user_name?.toLowerCase().includes(query) || access.user_email?.toLowerCase().includes(query) || access.scanner_name?.toLowerCase().includes(query) || access.scanner_location?.toLowerCase().includes(query) || access.granted_by_name?.toLowerCase().includes(query);
        });

        // Then sort
        const sorted = [...filtered].sort((a, b) => {
            let aValue: string | number | Date | null = null;
            let bValue: string | number | Date | null = null;

            switch (sortField) {
                case 'id':
                    aValue = a.id;
                    bValue = b.id;
                    break;
                case 'user_name':
                    aValue = a.user_name || '';
                    bValue = b.user_name || '';
                    break;
                case 'scanner_name':
                    aValue = a.scanner_name || '';
                    bValue = b.scanner_name || '';
                    break;
                case 'granted_by_name':
                    aValue = a.granted_by_name || '';
                    bValue = b.granted_by_name || '';
                    break;
                case 'created_at':
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    break;
                case 'expires_at':
                    aValue = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
                    bValue = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
                    break;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
        });

        return sorted;
    }, [accessList, searchQuery, statusFilter, sortField, sortDirection]);

    // Paginated access
    const paginatedAccess = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredAndSortedAccess.slice(startIndex, startIndex + pageSize);
    }, [filteredAndSortedAccess, pageSize, currentPage]);

    // Total pages
    const totalPages = useMemo(() => {
        return Math.ceil(filteredAndSortedAccess.length / pageSize);
    }, [filteredAndSortedAccess.length, pageSize]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, pageSize]);

    // Handle page change with scroll to top
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle page size change
    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    // Clear all filters
    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setSortField('created_at');
        setSortDirection('desc');
    };

    const hasActiveFilters = searchQuery || statusFilter !== 'all';

    // Toggle sort
    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort icon component
    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
    };

    // Handlers
    const handleGrantAccess = async () => {
        if (!grantForm.form.user_id || !grantForm.form.scanner_id) {
            toast.error('Please select both user and scanner');
            return;
        }

        const success = await submit(async () => {
            const { error } = await supabase.from('scanner_access').insert({
                user_id: grantForm.form.user_id,
                scanner_id: grantForm.form.scanner_id,
                granted_by: currentUser?.id,
                expires_at: grantForm.form.is_permanent ? null : grantForm.form.expires_at || null
            });

            if (error) {
                if (error.code === '23505') {
                    toast.error('Access already exists', { description: 'This user already has access to this scanner' });
                } else {
                    toast.error('Failed to grant access', { description: error.message });
                }
                return false;
            }

            const user = users.find((u) => u.id === grantForm.form.user_id);
            const scanner = scanners.find((d) => d.id === grantForm.form.scanner_id);
            toast.success('Access granted', { description: `${user?.full_name || user?.email} now has access to ${scanner?.name}` });
            await fetchData();
            return true;
        });

        if (success) {
            grantDialog.close();
            grantForm.reset();
        }
    };

    const handleRevokeAccess = async () => {
        if (!revokeDialog.selectedItem) { return; }

        const access = revokeDialog.selectedItem;

        const { error } = await supabase.from('scanner_access').delete().eq('id', access.id);

        if (error) {
            toast.error('Failed to revoke access', { description: error.message });
            return;
        }

        toast.success('Access revoked', { description: `Revoked ${access.user_name}'s access to ${access.scanner_name}` });
        revokeDialog.close();
        fetchData();
    };

    const handleEditAccess = async () => {
        if (!editDialog.selectedItem) {
            return;
        }

        const success = await submit(async () => {
            // If permanent, set to null. If temporary, use the date or null if empty
            const newExpiresAt = editForm.form.is_permanent ? null : editForm.form.expires_at || null;

            const { data, error } = await supabase
                .from('scanner_access')
                .update({
                    expires_at: newExpiresAt
                })
                .eq('id', editDialog.selectedItem!.id)
                .select();

            if (error) {
                logger.error('Error updating access:', error);
                toast.error('Failed to update access', { description: error.message });
                return false;
            }

            if (!data || data.length === 0) {
                toast.error('Failed to update access', { description: 'No rows were updated. You may not have permission.' });
                return false;
            }

            toast.success('Access updated', { description: `Updated expiration for ${editDialog.selectedItem!.user_name}'s access to ${editDialog.selectedItem!.scanner_name}` });
            await fetchData();
            return true;
        });

        if (success) {
            editDialog.close();
        }
    };

    const handleToggleAccessActive = async () => {
        if (!toggleActiveDialog.selectedItem) { return; }

        const access = toggleActiveDialog.selectedItem;
        const newStatus = !access.is_active;
        const action = newStatus ? 'enable' : 'disable';

        const { error } = await supabase.from('scanner_access').update({ is_active: newStatus }).eq('id', access.id);

        if (error) {
            toast.error(`Failed to ${action} access`, { description: error.message });
            return;
        }

        toast.success(`Access ${newStatus ? 'enabled' : 'disabled'}`, {
            description: `${access.user_name}'s access to ${access.scanner_name} has been ${newStatus ? 'enabled' : 'disabled'}`
        });
        toggleActiveDialog.close();
        fetchData();
    };

    const openEditDialog = (access: ExtendedScannerAccess) => {
        const isPermanent = !access.expires_at;
        const expiresAt = access.expires_at ? new Date(access.expires_at).toISOString().split('T')[0] : '';
        editForm.reset({ expires_at: expiresAt, is_permanent: isPermanent });
        editDialog.open(access);
    };

    // Summary data
    const accessByUser = users
        .map((user) => ({
            ...user,
            scannerCount: accessList.filter((a) => a.user_id === user.id && !isExpired(a.expires_at)).length
        }))
        .filter((u) => u.scannerCount > 0);

    const accessByScanner = scanners.map((scanner) => ({
        ...scanner,
        userCount: accessList.filter((a) => a.scanner_id === scanner.id && !isExpired(a.expires_at)).length
    }));

    // Table columns
    const columns: Column<ExtendedScannerAccess>[] = [
        {
            key: 'id',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('id')}>
          ID <SortIcon field="id" />
                </button>
            ),
            render: (access) => <CopyableId id={access.id} />
        },
        {
            key: 'user',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('user_name')}>
          User <SortIcon field="user_name" />
                </button>
            ),
            render: (access) => (
                <div>
                    <p className="font-medium">{access.user_name || 'Unknown'}</p>
                    {access.user_email && <p className="text-xs text-muted-foreground">{access.user_email}</p>}
                </div>
            )
        },
        {
            key: 'scanner',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('scanner_name')}>
          Scanner <SortIcon field="scanner_name" />
                </button>
            ),
            render: (access) => (
                <div>
                    <p>{access.scanner_name || 'Unknown'}</p>
                    {access.scanner_location && <p className="text-xs text-muted-foreground">{access.scanner_location}</p>}
                </div>
            )
        },
        {
            key: 'granted_by',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('granted_by_name')}>
          Granted By <SortIcon field="granted_by_name" />
                </button>
            ),
            render: (access) => <span className="text-muted-foreground">{access.granted_by_name || 'System'}</span>
        },
        {
            key: 'granted_on',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('created_at')}>
          Granted On <SortIcon field="created_at" />
                </button>
            ),
            render: (access) => new Date(access.created_at).toLocaleDateString()
        },
        {
            key: 'expires',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('expires_at')}>
          Expires <SortIcon field="expires_at" />
                </button>
            ),
            render: (access) => <Badge variant={isExpired(access.expires_at) ? 'destructive' : access.expires_at ? 'secondary' : 'default'}>{formatExpiry(access.expires_at)}</Badge>
        },
        {
            key: 'status',
            header: 'Status',
            render: (access) => {
                const expired = isExpired(access.expires_at);
                return <Badge variant={getAccessStatusBadgeVariant(access.is_active, expired)}>{getAccessStatusLabel(access.is_active, expired)}</Badge>;
            }
        }
    ];

    // Table actions
    const actions: Action<ExtendedScannerAccess>[] = [
        {
            label: 'Edit Expiration',
            icon: Pencil,
            onClick: openEditDialog,
            show: () => canGrantAccess
        },
        {
            label: (access: ExtendedScannerAccess) => (access.is_active ? 'Disable Access' : 'Enable Access'),
            iconGetter: (access: ExtendedScannerAccess) => (access.is_active ? ToggleLeft : ToggleRight),
            onClick: (access: ExtendedScannerAccess) => toggleActiveDialog.open(access),
            show: () => canGrantAccess,
            separator: true
        },
        {
            label: 'Revoke Access',
            icon: Trash2,
            onClick: (access: ExtendedScannerAccess) => revokeDialog.open(access),
            variant: 'destructive',
            show: () => canRevokeAccess
        }
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Access Control"
                description="Manage user access permissions to scanners"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
                        </Button>
                        {canGrantAccess && (
                            <Button onClick={() => grantDialog.open()}>
                                <Plus className="mr-2 h-4 w-4" />
                Grant Access
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Statistics */}
            <StatCardsGrid columns={3}>
                <StatCard title="Total Permissions" value={accessList.filter((a) => !isExpired(a.expires_at)).length} description="Active access grants" icon={Shield} />
                <StatCard title="Users with Access" value={accessByUser.length} description={`Out of ${users.length} total users`} icon={Users} />
                <StatCard title="Protected Scanners" value={accessByScanner.filter((d) => d.userCount > 0).length} description={`Out of ${scanners.length} total scanners`} icon={ScanLine} />
            </StatCardsGrid>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Access by User</CardTitle>
                        <CardDescription>Number of scanners each user can access</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <ListSkeleton items={5} />
                        ) : accessByUser.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground animate-in fade-in duration-300">No access grants yet</div>
                        ) : (
                            <div className="space-y-4">
                                {accessByUser.slice(0, 5).map((user, index) => (
                                    <div key={user.id} className="flex items-center justify-between animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                        <div>
                                            <p className="font-medium">{user.full_name || 'Unnamed'}</p>
                                            <p className="text-sm text-muted-foreground">{user.email}</p>
                                        </div>
                                        <Badge variant="secondary">{user.scannerCount} scanners</Badge>
                                    </div>
                                ))}
                                {accessByUser.length > 5 && <p className="text-sm text-muted-foreground text-center">And {accessByUser.length - 5} more users...</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Access by Scanner</CardTitle>
                        <CardDescription>Number of users with access to each scanner</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <ListSkeleton items={5} />
                        ) : accessByScanner.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground animate-in fade-in duration-300">No scanners configured</div>
                        ) : (
                            <div className="space-y-4">
                                {accessByScanner.slice(0, 5).map((scanner, index) => (
                                    <div key={scanner.id} className="flex items-center justify-between animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                        <div>
                                            <p className="font-medium">{scanner.name}</p>
                                            <p className="text-sm text-muted-foreground">{scanner.location}</p>
                                        </div>
                                        <Badge variant="secondary">{scanner.userCount} users</Badge>
                                    </div>
                                ))}
                                {accessByScanner.length > 5 && <p className="text-sm text-muted-foreground text-center">And {accessByScanner.length - 5} more scanners...</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

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
                                <Input placeholder="Search by ID, user, scanner, or granted by..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'disabled' | 'expired') => setStatusFilter(value)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="disabled">Disabled</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                            {hasActiveFilters && (
                                <Button variant="outline" onClick={clearFilters}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Access Table */}
            <DataTable
                title="All Access Permissions"
                description={`${filteredAndSortedAccess.length} uprawnień${filteredAndSortedAccess.length !== accessList.length ? ` (${accessList.length} łącznie)` : ''}`}
                columns={columns}
                data={paginatedAccess}
                actions={actions}
                isLoading={isLoading}
                loadingMessage="Loading access data..."
                emptyMessage='No access permissions granted yet. Click "Grant Access" to add one.'
                keyExtractor={(access) => access.id}
                rowClassName={(access) => (isExpired(access.expires_at) ? 'opacity-50' : '')}
                pagination={{
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems: filteredAndSortedAccess.length,
                    onPageChange: handlePageChange,
                    onPageSizeChange: handlePageSizeChange
                }}
            />

            {/* Grant Access Dialog */}
            <FormDialog open={grantDialog.isOpen} onOpenChange={(open) => !open && grantDialog.close()} title="Grant Scanner Access" description="Give a user permission to access a specific scanner" onSubmit={handleGrantAccess} submitLabel="Grant Access" submitLoadingLabel="Granting..." isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="user">User</Label>
                    <UserSearchSelect users={users} value={grantForm.form.user_id} onChange={(v) => grantForm.updateField('user_id', v)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="scanner">Scanner</Label>
                    <ScannerSearchSelect scanners={scanners} value={grantForm.form.scanner_id} onChange={(v) => grantForm.updateField('scanner_id', v)} />
                </div>
                <div className="space-y-4">
                    <Label>Access Duration</Label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="access_type"
                                checked={grantForm.form.is_permanent}
                                onChange={() => {
                                    grantForm.updateField('is_permanent', true as any);
                                    grantForm.updateField('expires_at', '');
                                }}
                                className="h-4 w-4"
                            />
                            <span>Permanent (no expiration)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="access_type" checked={!grantForm.form.is_permanent} onChange={() => grantForm.updateField('is_permanent', false as any)} className="h-4 w-4" />
                            <span>Temporary (with expiration)</span>
                        </label>
                    </div>
                    {!grantForm.form.is_permanent && (
                        <div className="space-y-2">
                            <Label htmlFor="expires_at">Expiration Date</Label>
                            <Input id="expires_at" type="date" value={grantForm.form.expires_at} onChange={(e) => grantForm.updateField('expires_at', e.target.value)} min={new Date().toISOString().split('T')[0]} />
                        </div>
                    )}
                </div>
            </FormDialog>

            {/* Edit Access Dialog */}
            <FormDialog
                open={editDialog.isOpen}
                onOpenChange={(open) => !open && editDialog.close()}
                title="Edit Access Expiration"
                description={
                    editDialog.selectedItem ? (
                        <>
              Update expiration for <strong>{editDialog.selectedItem.user_name}</strong>&apos;s access to <strong>{editDialog.selectedItem.scanner_name}</strong>
                        </>
                    ) : (
                        'Update access expiration'
                    )
                }
                onSubmit={handleEditAccess}
                submitLabel="Save Changes"
                submitLoadingLabel="Saving..."
                isSubmitting={isSubmitting}>
                <div className="space-y-4">
                    <Label>Access Duration</Label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="edit_access_type"
                                checked={editForm.form.is_permanent}
                                onChange={() => {
                                    editForm.updateField('is_permanent', true as any);
                                    editForm.updateField('expires_at', '');
                                }}
                                className="h-4 w-4"
                            />
                            <span>Permanent (no expiration)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="edit_access_type" checked={!editForm.form.is_permanent} onChange={() => editForm.updateField('is_permanent', false as any)} className="h-4 w-4" />
                            <span>Temporary (with expiration)</span>
                        </label>
                    </div>
                    {!editForm.form.is_permanent && (
                        <div className="space-y-2">
                            <Label htmlFor="edit_expires_at">Expiration Date</Label>
                            <Input id="edit_expires_at" type="date" value={editForm.form.expires_at} onChange={(e) => editForm.updateField('expires_at', e.target.value)} min={new Date().toISOString().split('T')[0]} />
                        </div>
                    )}
                </div>
            </FormDialog>

            {/* Revoke Access Confirm Dialog */}
            <ConfirmDialog open={revokeDialog.isOpen} onOpenChange={(open) => !open && revokeDialog.close()} title="Revoke Access" description={`Are you sure you want to revoke ${revokeDialog.selectedItem?.user_name}'s access to ${revokeDialog.selectedItem?.scanner_name}? This action cannot be undone.`} onConfirm={handleRevokeAccess} confirmLabel="Revoke" variant="destructive" />

            {/* Toggle Access Active Confirm Dialog */}
            <ConfirmDialog open={toggleActiveDialog.isOpen} onOpenChange={(open) => !open && toggleActiveDialog.close()} title={toggleActiveDialog.selectedItem?.is_active ? 'Disable Access' : 'Enable Access'} description={toggleActiveDialog.selectedItem?.is_active ? `Are you sure you want to disable ${toggleActiveDialog.selectedItem?.user_name}'s access to ${toggleActiveDialog.selectedItem?.scanner_name}? They will not be able to use this scanner.` : `Are you sure you want to enable ${toggleActiveDialog.selectedItem?.user_name}'s access to ${toggleActiveDialog.selectedItem?.scanner_name}? They will be able to use this scanner again.`} onConfirm={handleToggleAccessActive} confirmLabel={toggleActiveDialog.selectedItem?.is_active ? 'Disable' : 'Enable'} variant={toggleActiveDialog.selectedItem?.is_active ? 'destructive' : 'default'} />
        </div>
    );
}
