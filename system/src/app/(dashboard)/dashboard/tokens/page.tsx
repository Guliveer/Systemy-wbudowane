'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, CreditCard, Ban, Check, Search, RefreshCw, X, User as UserIcon, Filter, ArrowUpDown, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { formatLastUsed } from '@/lib/utils/format';
import { PageHeader, StatCard, StatCardsGrid, DataTable, FormDialog } from '@/components/dashboard';
import { useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import type { Token, User } from '@/types/database';
import type { Column, Action } from '@/components/dashboard/data-table';

interface ExtendedToken extends Token {
  user_name?: string;
  user_email?: string;
}

type SortField = 'id' | 'rfid_uid' | 'name' | 'user_name' | 'last_used_at' | 'is_active' | 'created_at';
type SortDirection = 'asc' | 'desc';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

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

    // Filter and sort tokens
    const filteredAndSortedTokens = useMemo(() => {
        const filtered = tokens.filter((token) => {
            // Status filter
            if (statusFilter === 'active' && !token.is_active) { return false; }
            if (statusFilter === 'disabled' && token.is_active) { return false; }

            // Search query filter
            if (!searchQuery) { return true; }
            const query = searchQuery.toLowerCase();
            return token.id.toLowerCase().includes(query) || token.rfid_uid.toLowerCase().includes(query) || token.name.toLowerCase().includes(query) || token.user_name?.toLowerCase().includes(query) || token.user_email?.toLowerCase().includes(query);
        });

        // Sort
        return [...filtered].sort((a, b) => {
            let aValue: string | boolean | Date | null = null;
            let bValue: string | boolean | Date | null = null;

            switch (sortField) {
                case 'id':
                    aValue = a.id;
                    bValue = b.id;
                    break;
                case 'rfid_uid':
                    aValue = a.rfid_uid;
                    bValue = b.rfid_uid;
                    break;
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'user_name':
                    aValue = a.user_name || '';
                    bValue = b.user_name || '';
                    break;
                case 'last_used_at':
                    aValue = a.last_used_at ? new Date(a.last_used_at) : null;
                    bValue = b.last_used_at ? new Date(b.last_used_at) : null;
                    break;
                case 'is_active':
                    aValue = a.is_active;
                    bValue = b.is_active;
                    break;
                case 'created_at':
                    aValue = a.created_at ? new Date(a.created_at) : null;
                    bValue = b.created_at ? new Date(b.created_at) : null;
                    break;
            }

            // Handle null values
            if (aValue === null && bValue === null) { return 0; }
            if (aValue === null) { return sortDirection === 'asc' ? 1 : -1; }
            if (bValue === null) { return sortDirection === 'asc' ? -1 : 1; }

            // Compare values
            if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                return sortDirection === 'asc' ? (aValue === bValue ? 0 : aValue ? 1 : -1) : aValue === bValue ? 0 : aValue ? -1 : 1;
            }

            if (aValue instanceof Date && bValue instanceof Date) {
                return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
            }

            const comparison = String(aValue).localeCompare(String(bValue));
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [tokens, searchQuery, statusFilter, sortField, sortDirection]);

    // Paginate tokens
    const paginatedTokens = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredAndSortedTokens.slice(startIndex, startIndex + pageSize);
    }, [filteredAndSortedTokens, pageSize, currentPage]);

    // Total pages
    const totalPages = useMemo(() => {
        return Math.ceil(filteredAndSortedTokens.length / pageSize);
    }, [filteredAndSortedTokens.length, pageSize]);

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

    // Copyable ID component
    const CopyableId = ({ id }: { id: string }) => {
        const handleCopy = async () => {
            await navigator.clipboard.writeText(id);
            toast.success('ID skopiowane do schowka');
        };

        return (
            <div className="inline-flex items-center gap-1">
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{id}</code>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy} title="Kopiuj ID">
                    <Copy className="h-3 w-3" />
                </Button>
            </div>
        );
    };

    // Clear all filters
    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setSortField('created_at');
        setSortDirection('desc');
    };

    const hasActiveFilters = searchQuery || statusFilter !== 'all' || sortField !== 'created_at' || sortDirection !== 'desc';

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
        if (!editDialog.selectedItem) {
            return;
        }

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
        if (!confirm(`Are you sure you want to delete token "${token.name}"?`)) {
            return;
        }

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

    // Table columns
    const columns: Column<ExtendedToken>[] = [
        {
            key: 'id',
            header: (
                <button onClick={() => toggleSort('id')} className="inline-flex items-center hover:text-foreground">
          ID
                    <SortIcon field="id" />
                </button>
            ),
            render: (token) => <CopyableId id={token.id} />
        },
        {
            key: 'rfid_uid',
            header: (
                <button onClick={() => toggleSort('rfid_uid')} className="inline-flex items-center hover:text-foreground">
          RFID UID
                    <SortIcon field="rfid_uid" />
                </button>
            ),
            render: (token) => <span className="font-mono font-medium">{token.rfid_uid}</span>
        },
        {
            key: 'name',
            header: (
                <button onClick={() => toggleSort('name')} className="inline-flex items-center hover:text-foreground">
          Name
                    <SortIcon field="name" />
                </button>
            ),
            render: (token) => token.name
        },
        {
            key: 'user',
            header: (
                <button onClick={() => toggleSort('user_name')} className="inline-flex items-center hover:text-foreground">
          Assigned To
                    <SortIcon field="user_name" />
                </button>
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
                <button onClick={() => toggleSort('last_used_at')} className="inline-flex items-center hover:text-foreground">
          Last Used
                    <SortIcon field="last_used_at" />
                </button>
            ),
            render: (token) => <span className="text-muted-foreground">{formatLastUsed(token.last_used_at)}</span>
        },
        {
            key: 'status',
            header: (
                <button onClick={() => toggleSort('is_active')} className="inline-flex items-center hover:text-foreground">
          Status
                    <SortIcon field="is_active" />
                </button>
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

    // User select component with search
    const UserSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
        const [userSearchQuery, setUserSearchQuery] = useState('');
        const [isOpen, setIsOpen] = useState(false);

        const selectedUser = users.find((u) => u.id === value);

        const filteredUsers = useMemo(() => {
            if (!userSearchQuery) { return users.slice(0, 50); } // Show first 50 users when no search
            const query = userSearchQuery.toLowerCase();
            return users.filter((user) => user.full_name?.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)).slice(0, 50); // Limit to 50 results
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
                {/* Selected user display or search input */}
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

                {/* Dropdown with filtered users */}
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

                {/* Backdrop to close dropdown */}
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
    };

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
                                <Input placeholder="Search by ID, RFID UID, name, or user..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                        <div className="inline-flex gap-4 flex-wrap">
                            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'disabled') => setStatusFilter(value)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="disabled">Disabled</SelectItem>
                                </SelectContent>
                            </Select>
                            {hasActiveFilters && (
                                <Button variant="outline" onClick={clearFilters}>
                                    <X className="mr-2 h-4 w-4" />
                  Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

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
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems: filteredAndSortedTokens.length,
                    onPageChange: handlePageChange,
                    onPageSizeChange: handlePageSizeChange
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
                    <UserSelect value={createForm.form.user_id} onChange={(v) => createForm.updateField('user_id', v)} />
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
                    <UserSelect value={editForm.form.user_id} onChange={(v) => editForm.updateField('user_id', v)} />
                </div>
            </FormDialog>
        </div>
    );
}
