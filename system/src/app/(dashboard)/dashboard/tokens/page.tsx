'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, CreditCard, Ban, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { formatLastUsed } from '@/lib/utils/format';
import { PageHeader, StatCard, StatCardsGrid, DataTable, FormDialog, CopyableRfid, SortableHeader, FilterCard, SearchInput, FilterSelect, ClearFiltersButton, FilterGrid, FilterRow, STATUS_FILTER_OPTIONS, UserSearchSelect } from '@/components/dashboard';
import { useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import { useTable, sortData } from '@/hooks/use-table';
import type { Token, User } from '@/types/database';
import type { Column, Action } from '@/components/dashboard/data-table';

interface ExtendedToken extends Token {
  user_name?: string;
  user_email?: string;
}

type SortField = 'id' | 'rfid_uid' | 'name' | 'user_name' | 'last_used_at' | 'is_active' | 'created_at';
type FilterState = { status: string };

interface TokenForm {
  rfid_uid: string;
  name: string;
  user_id: string;
}

const initialCreateForm: TokenForm = { rfid_uid: '', name: '', user_id: '' };
const initialEditForm = { name: '', user_id: '' };

export default function TokensPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();

    const [tokens, setTokens] = useState<ExtendedToken[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const table = useTable<SortField, FilterState>({
        sort: { defaultField: 'created_at', defaultDirection: 'desc' },
        filter: { defaultFilters: { status: 'all' } }
    });

    const createDialog = useDialog<ExtendedToken>();
    const editDialog = useDialog<ExtendedToken>();
    const createForm = useForm<TokenForm>(initialCreateForm);
    const editForm = useForm<typeof initialEditForm>(initialEditForm);
    const { isSubmitting, submit } = useSubmit();

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: tokensData, error: tokensError } = await supabase.from('tokens').select('*, users:user_id (id, full_name, email)').order('created_at', { ascending: false });

            if (tokensError) {
                logger.error('Error fetching tokens:', tokensError);
                toast.error('Failed to fetch tokens');
            } else {
                const transformedTokens = (tokensData || []).map((token: any) => ({
                    ...token,
                    user_name: token.users?.full_name,
                    user_email: token.users?.email
                }));
                setTokens(transformedTokens);
            }

            const { data: usersData } = await supabase.from('users').select('*').order('full_name');
            setUsers(usersData || []);
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
    const canCreateTokens = currentUserRole === 'root' || currentUserRole === 'admin';
    const canEditTokens = currentUserRole === 'root' || currentUserRole === 'admin';
    const canDeleteTokens = currentUserRole === 'root';

    // Filter and sort tokens (using debouncedSearchQuery for performance)
    const filteredAndSortedTokens = useMemo(() => {
        const filtered = tokens.filter((token) => {
            if (table.filters.status === 'active' && !token.is_active) { return false; }
            if (table.filters.status === 'disabled' && token.is_active) { return false; }

            // Search query filter (using debounced value)
            if (!table.debouncedSearchQuery) { return true; }
            const query = table.debouncedSearchQuery.toLowerCase();
            return token.id.toLowerCase().includes(query) || token.rfid_uid.toLowerCase().includes(query) || token.name.toLowerCase().includes(query) || token.user_name?.toLowerCase().includes(query) || token.user_email?.toLowerCase().includes(query);
        });

        return sortData(filtered, table.sortField as keyof ExtendedToken, table.sortDirection, (item, field) => {
            if (field === 'last_used_at') { return item.last_used_at ? new Date(item.last_used_at).getTime() : null; }
            if (field === 'is_active') { return item.is_active; }
            if (field === 'created_at') { return item.created_at ? new Date(item.created_at).getTime() : null; }
            if (field === 'user_name') { return item.user_name || ''; }
            return item[field as keyof ExtendedToken] as string;
        });
    }, [tokens, table.debouncedSearchQuery, table.filters, table.sortField, table.sortDirection]);

    // Paginated data
    const paginatedTokens = table.getPaginatedData(filteredAndSortedTokens);
    const totalPages = table.getTotalPages(filteredAndSortedTokens.length);

    // Handlers
    const handleCreate = async () => {
        if (!createForm.form.rfid_uid || !createForm.form.name || !createForm.form.user_id) {
            toast.error('Please fill in all fields');
            return;
        }

        const success = await submit(async () => {
            const { error } = await supabase.from('tokens').insert({
                rfid_uid: createForm.form.rfid_uid.toUpperCase(),
                name: createForm.form.name,
                user_id: createForm.form.user_id,
                is_active: true
            });

            if (error) {
                if (error.code === '23505') {
                    toast.error('Token already exists', { description: 'A token with this RFID UID is already registered' });
                } else {
                    toast.error('Failed to create token', { description: error.message });
                }
                return false;
            }

            toast.success('Token registered successfully');
            await fetchData();
            return true;
        });

        if (success) {
            createDialog.close();
            createForm.reset();
        }
    };

    const handleEdit = async () => {
        if (!editDialog.selectedItem) { return; }

        const success = await submit(async () => {
            const { error } = await supabase.from('tokens').update({ name: editForm.form.name, user_id: editForm.form.user_id }).eq('id', editDialog.selectedItem!.id);

            if (error) {
                toast.error('Failed to update token', { description: error.message });
                return false;
            }

            toast.success('Token updated successfully');
            await fetchData();
            return true;
        });

        if (success) {
            editDialog.close();
        }
    };

    const handleToggleStatus = async (token: ExtendedToken) => {
        const { error } = await supabase.from('tokens').update({ is_active: !token.is_active }).eq('id', token.id);

        if (error) {
            toast.error('Failed to update token status', { description: error.message });
            return;
        }

        toast.success(`Token ${token.is_active ? 'deactivated' : 'activated'}`);
        fetchData();
    };

    const handleDelete = async (token: ExtendedToken) => {
        if (!confirm(`Are you sure you want to delete token "${token.name}"?`)) { return; }

        const { error } = await supabase.from('tokens').delete().eq('id', token.id);

        if (error) {
            toast.error('Failed to delete token', { description: error.message });
            return;
        }

        toast.success('Token deleted');
        fetchData();
    };

    const openEditDialog = (token: ExtendedToken) => {
        editForm.reset({ name: token.name, user_id: token.user_id });
        editDialog.open(token);
    };

    // Helper for sort handler
    const handleSort = (field: string) => table.toggleSort(field as SortField);

    // Table columns
    const columns: Column<ExtendedToken>[] = [
        {
            key: 'rfid_uid',
            header: (
                <SortableHeader field="rfid_uid" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          RFID Token
                </SortableHeader>
            ),
            render: (token) => <CopyableRfid rfidUid={token.rfid_uid} />
        },
        {
            key: 'name',
            header: (
                <SortableHeader field="name" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Name
                </SortableHeader>
            ),
            render: (token) => token.name
        },
        {
            key: 'user',
            header: (
                <SortableHeader field="user_name" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Assigned To
                </SortableHeader>
            ),
            render: (token) => (
                <div>
                    <p>{token.user_name || '—'}</p>
                    {token.user_email && <p className="text-xs text-muted-foreground">{token.user_email}</p>}
                </div>
            )
        },
        {
            key: 'last_used',
            header: (
                <SortableHeader field="last_used_at" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Last Used
                </SortableHeader>
            ),
            render: (token) => <span className="text-muted-foreground">{formatLastUsed(token.last_used_at)}</span>
        },
        {
            key: 'status',
            header: (
                <SortableHeader field="is_active" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Status
                </SortableHeader>
            ),
            render: (token) => (
                <Badge variant={token.is_active ? 'default' : 'secondary'} className={token.is_active ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                    {token.is_active ? 'Active' : 'Disabled'}
                </Badge>
            )
        }
    ];

    // Table actions
    const actions: Action<ExtendedToken>[] = [
        { label: 'Edit', icon: Pencil, onClick: openEditDialog, show: () => canEditTokens },
        { label: 'Disable', icon: Ban, onClick: handleToggleStatus, show: (t) => canEditTokens && t.is_active },
        { label: 'Enable', icon: Check, onClick: handleToggleStatus, show: (t) => canEditTokens && !t.is_active },
        { label: 'Delete', icon: Trash2, onClick: handleDelete, variant: 'destructive', separator: true, show: () => canDeleteTokens }
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tokens"
                description="Manage RFID tokens and their assignments"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
                        </Button>
                        {canCreateTokens && (
                            <Button onClick={() => createDialog.open()}>
                                <Plus className="mr-2 h-4 w-4" />
                Register Token
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Statistics */}
            <StatCardsGrid columns={4}>
                <StatCard title="Total Tokens" value={tokens.length} description="Registered RFID tokens" icon={CreditCard} />
                <StatCard title="Active" value={tokens.filter((t) => t.is_active).length} description="Currently enabled" icon={Check} iconClassName="text-green-500" />
                <StatCard title="Disabled" value={tokens.filter((t) => !t.is_active).length} description="Lost or revoked" icon={Ban} iconClassName="text-red-500" />
                <StatCard title="Users with Tokens" value={new Set(tokens.map((t) => t.user_id)).size} description="Unique users" icon={CreditCard} iconClassName="text-blue-500" />
            </StatCardsGrid>

            {/* Filters */}
            <FilterCard>
                <FilterGrid>
                    <div className="md:col-span-2">
                        <SearchInput value={table.searchQuery} onChange={table.setSearchQuery} placeholder="Search by ID, RFID UID, name, or user..." />
                    </div>
                    <FilterRow>
                        <FilterSelect value={table.filters.status} onChange={(v) => table.setFilter('status', v)} options={STATUS_FILTER_OPTIONS} />
                        <ClearFiltersButton onClick={table.clearFilters} show={table.hasActiveFilters} />
                    </FilterRow>
                </FilterGrid>
            </FilterCard>

            {/* Tokens Table */}
            <DataTable
                title="All Tokens"
                description={`${filteredAndSortedTokens.length} tokenów${filteredAndSortedTokens.length !== tokens.length ? ` (${tokens.length} łącznie)` : ''}`}
                columns={columns}
                data={paginatedTokens}
                actions={actions}
                isLoading={isLoading}
                loadingMessage="Loading tokens..."
                keyExtractor={(token) => token.id}
                pagination={{
                    currentPage: table.currentPage,
                    totalPages,
                    pageSize: table.pageSize,
                    totalItems: filteredAndSortedTokens.length,
                    onPageChange: table.handlePageChange,
                    onPageSizeChange: table.handlePageSizeChange
                }}
            />

            {/* Create Dialog */}
            <FormDialog open={createDialog.isOpen} onOpenChange={(open) => !open && createDialog.close()} title="Register New Token" description="Add a new RFID token and assign it to a user" onSubmit={handleCreate} submitLabel="Register Token" submitLoadingLabel="Registering..." isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="rfid_uid">RFID UID</Label>
                    <Input id="rfid_uid" placeholder="e.g., A1B2C3D4" value={createForm.form.rfid_uid} onChange={(e) => createForm.updateField('rfid_uid', e.target.value.toUpperCase())} />
                    <p className="text-xs text-muted-foreground">The unique identifier from the RFID card/tag</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">Token Name</Label>
                    <Input id="name" placeholder="e.g., Main Card, Keychain" value={createForm.form.name} onChange={(e) => createForm.updateField('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="user">Assign to User</Label>
                    <UserSearchSelect users={users} value={createForm.form.user_id} onChange={(v) => createForm.updateField('user_id', v)} />
                </div>
            </FormDialog>

            {/* Edit Dialog */}
            <FormDialog
                open={editDialog.isOpen}
                onOpenChange={(open) => !open && editDialog.close()}
                title="Edit Token"
                description={
                    <>
            Update token information for RFID UID: <code className="font-mono bg-muted px-1 rounded">{editDialog.selectedItem?.rfid_uid}</code>
                    </>
                }
                onSubmit={handleEdit}
                submitLabel="Save Changes"
                submitLoadingLabel="Saving..."
                isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="edit_name">Token Name</Label>
                    <Input id="edit_name" placeholder="e.g., Main Card, Keychain" value={editForm.form.name} onChange={(e) => editForm.updateField('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit_user">Assigned User</Label>
                    <UserSearchSelect users={users} value={editForm.form.user_id} onChange={(v) => editForm.updateField('user_id', v)} />
                </div>
            </FormDialog>
        </div>
    );
}
