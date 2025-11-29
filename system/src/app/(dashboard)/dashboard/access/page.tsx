'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield, Users, ScanLine, RefreshCw, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { isExpired, formatExpiry } from '@/lib/utils/format';
import { PageHeader, StatCard, StatCardsGrid, DataTable, FormDialog, ConfirmDialog, CopyableId, SortableHeader, FilterCard, SearchInput, FilterSelect, ClearFiltersButton, FilterGrid, FilterRow, STATUS_WITH_EXPIRED_OPTIONS, UserSearchSelect, ScannerSearchSelect } from '@/components/dashboard';
import { ListSkeleton } from '@/components/ui/loading-skeletons';
import { useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import { useTable, sortData } from '@/hooks/use-table';
import type { ScannerAccess, User, Scanner } from '@/types/database';
import type { Column, Action } from '@/components/dashboard/data-table';

interface ExtendedScannerAccess extends ScannerAccess {
  user_name?: string;
  user_email?: string;
  scanner_name?: string;
  scanner_location?: string;
  granted_by_name?: string;
}

// Helper functions
const getAccessStatusBadgeVariant = (isActive: boolean, expired: boolean): 'default' | 'secondary' | 'destructive' => {
    if (expired) { return 'destructive'; }
    if (!isActive) { return 'secondary'; }
    return 'default';
};

const getAccessStatusLabel = (isActive: boolean, expired: boolean): string => {
    if (expired) { return 'Expired'; }
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
type FilterState = { status: string };

export default function AccessPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();

    const [accessList, setAccessList] = useState<ExtendedScannerAccess[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [scanners, setScanners] = useState<Scanner[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const table = useTable<SortField, FilterState>({
        sort: { defaultField: 'created_at', defaultDirection: 'desc' },
        filter: { defaultFilters: { status: 'all' } }
    });

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

    // Filter and sort access list (using debouncedSearchQuery for performance)
    const filteredAndSortedAccess = useMemo(() => {
        const filtered = accessList.filter((access) => {
            const expired = isExpired(access.expires_at);
            if (table.filters.status === 'active' && (expired || !access.is_active)) { return false; }
            if (table.filters.status === 'disabled' && (access.is_active || expired)) { return false; }
            if (table.filters.status === 'expired' && !expired) { return false; }

            // Search query filter (using debounced value)
            if (!table.debouncedSearchQuery) { return true; }
            const query = table.debouncedSearchQuery.toLowerCase();
            return access.id.toLowerCase().includes(query) || access.user_name?.toLowerCase().includes(query) || access.user_email?.toLowerCase().includes(query) || access.scanner_name?.toLowerCase().includes(query) || access.scanner_location?.toLowerCase().includes(query) || access.granted_by_name?.toLowerCase().includes(query);
        });

        return sortData(filtered, table.sortField as keyof ExtendedScannerAccess, table.sortDirection, (item, field) => {
            if (field === 'created_at') { return new Date(item.created_at).getTime(); }
            if (field === 'expires_at') { return item.expires_at ? new Date(item.expires_at).getTime() : Number.MAX_SAFE_INTEGER; }
            if (field === 'user_name') { return item.user_name || ''; }
            if (field === 'scanner_name') { return item.scanner_name || ''; }
            if (field === 'granted_by_name') { return item.granted_by_name || ''; }
            return item[field as keyof ExtendedScannerAccess] as string;
        });
    }, [accessList, table.debouncedSearchQuery, table.filters, table.sortField, table.sortDirection]);

    // Paginated data
    const paginatedAccess = table.getPaginatedData(filteredAndSortedAccess);
    const totalPages = table.getTotalPages(filteredAndSortedAccess.length);

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
        if (!editDialog.selectedItem) { return; }

        const success = await submit(async () => {
            const newExpiresAt = editForm.form.is_permanent ? null : editForm.form.expires_at || null;

            const { data, error } = await supabase.from('scanner_access').update({ expires_at: newExpiresAt }).eq('id', editDialog.selectedItem!.id).select();

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

    // Helper for sort handler
    const handleSort = (field: string) => table.toggleSort(field as SortField);

    // Table columns
    const columns: Column<ExtendedScannerAccess>[] = [
        {
            key: 'id',
            header: (
                <SortableHeader field="id" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          ID
                </SortableHeader>
            ),
            render: (access) => <CopyableId id={access.id} />
        },
        {
            key: 'user',
            header: (
                <SortableHeader field="user_name" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          User
                </SortableHeader>
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
                <SortableHeader field="scanner_name" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Scanner
                </SortableHeader>
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
                <SortableHeader field="granted_by_name" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Granted By
                </SortableHeader>
            ),
            render: (access) => <span className="text-muted-foreground">{access.granted_by_name || 'System'}</span>
        },
        {
            key: 'granted_on',
            header: (
                <SortableHeader field="created_at" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Granted On
                </SortableHeader>
            ),
            render: (access) => new Date(access.created_at).toLocaleDateString()
        },
        {
            key: 'expires',
            header: (
                <SortableHeader field="expires_at" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Expires
                </SortableHeader>
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
        { label: 'Edit Expiration', icon: Pencil, onClick: openEditDialog, show: () => canGrantAccess },
        {
            label: (access) => (access.is_active ? 'Disable Access' : 'Enable Access'),
            iconGetter: (access) => (access.is_active ? ToggleLeft : ToggleRight),
            onClick: (access) => toggleActiveDialog.open(access),
            show: () => canGrantAccess,
            separator: true
        },
        {
            label: 'Revoke Access',
            icon: Trash2,
            onClick: (access) => revokeDialog.open(access),
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
                            <div className="text-center py-4 text-muted-foreground">No access grants yet</div>
                        ) : (
                            <div className="space-y-4">
                                {accessByUser.slice(0, 5).map((user, index) => (
                                    <div key={user.id} className="flex items-center justify-between" style={{ animationDelay: `${index * 50}ms` }}>
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
                            <div className="text-center py-4 text-muted-foreground">No scanners configured</div>
                        ) : (
                            <div className="space-y-4">
                                {accessByScanner.slice(0, 5).map((scanner, index) => (
                                    <div key={scanner.id} className="flex items-center justify-between" style={{ animationDelay: `${index * 50}ms` }}>
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
            <FilterCard>
                <FilterGrid>
                    <div className="md:col-span-2">
                        <SearchInput value={table.searchQuery} onChange={table.setSearchQuery} placeholder="Search by ID, user, scanner, or granted by..." />
                    </div>
                    <FilterRow>
                        <FilterSelect value={table.filters.status} onChange={(v) => table.setFilter('status', v)} options={STATUS_WITH_EXPIRED_OPTIONS} />
                        <ClearFiltersButton onClick={table.clearFilters} show={table.hasActiveFilters} />
                    </FilterRow>
                </FilterGrid>
            </FilterCard>

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
                    currentPage: table.currentPage,
                    totalPages,
                    pageSize: table.pageSize,
                    totalItems: filteredAndSortedAccess.length,
                    onPageChange: table.handlePageChange,
                    onPageSizeChange: table.handlePageSizeChange
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
