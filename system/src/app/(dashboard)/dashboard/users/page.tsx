'use client';

import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Shield, UserCog, Key, UserX, UserCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { createUser, deleteUser, resetUserPassword, toggleUserActive } from './actions';
import { PageHeader, DataTable, FormDialog, ConfirmDialog, CopyableId, SortableHeader, FilterCard, SearchInput, FilterSelect, ClearFiltersButton, FilterGrid, FilterRow, STATUS_FILTER_OPTIONS, ROLE_FILTER_OPTIONS } from '@/components/dashboard';
import { useCrud, useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import { useTable, sortData } from '@/hooks/use-table';
import type { User, UserRole } from '@/types/database';
import { canManageRole } from '@/types/database';
import type { Column, Action } from '@/components/dashboard/data-table';

// Form types
interface CreateUserForm {
  email: string;
  full_name: string;
  role: UserRole;
}

interface EditUserForm {
  full_name: string;
}

const initialCreateForm: CreateUserForm = { email: '', full_name: '', role: 'user' };
const initialEditForm: EditUserForm = { full_name: '' };

// Helper functions
const generateTempPassword = (email: string): string => {
    const localPart = email.split('@')[0];
    const currentYear = new Date().getFullYear();
    return `${localPart}${currentYear}`;
};

const getDefaultFullName = (email: string): string => {
    return email.split('@')[0];
};

const getRoleBadgeVariant = (role: UserRole): 'destructive' | 'default' | 'secondary' => {
    switch (role) {
        case 'root':
            return 'destructive';
        case 'admin':
            return 'default';
        default:
            return 'secondary';
    }
};

const getStatusBadgeVariant = (isActive: boolean): 'default' | 'secondary' => {
    return isActive ? 'default' : 'secondary';
};

type SortField = 'id' | 'full_name' | 'email' | 'role' | 'created_at';
type FilterState = { role: string; status: string };

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();
    const { data: users, isLoading, fetchData } = useCrud<User>({ table: 'users' });

    const table = useTable<SortField, FilterState>({
        sort: { defaultField: 'created_at', defaultDirection: 'desc' },
        filter: { defaultFilters: { role: 'all', status: 'all' } }
    });

    const createDialog = useDialog<User>();
    const editDialog = useDialog<User>();
    const roleDialog = useDialog<User>();
    const passwordDialog = useDialog<User>();
    const deleteDialog = useDialog<User>();
    const toggleActiveDialog = useDialog<User>();

    const createForm = useForm<CreateUserForm>(initialCreateForm);
    const editForm = useForm<EditUserForm>(initialEditForm);
    const roleForm = useForm<{ role: UserRole }>({ role: 'user' });
    const passwordForm = useForm<{ password: string }>({ password: '' });
    const { isSubmitting, submit } = useSubmit();

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Permissions
    const currentUserRole = currentUser?.role || 'user';
    const canCreateUsers = currentUserRole === 'root' || currentUserRole === 'admin';
    const canChangeRoles = currentUserRole === 'root';
    const canDeleteUsers = currentUserRole === 'root';

    const canManageUser = (targetUser: User): boolean => {
        if (!currentUser) { return false; }
        if (currentUser.id === targetUser.id) { return false; }
        return canManageRole(currentUserRole, targetUser.role);
    };

    // Filter and sort users (using debouncedSearchQuery for performance)
    const filteredAndSortedUsers = useMemo(() => {
        const filtered = users.filter((user) => {
            if (table.filters.role !== 'all' && user.role !== table.filters.role) { return false; }
            if (table.filters.status === 'active' && !user.is_active) { return false; }
            if (table.filters.status === 'disabled' && user.is_active) { return false; }

            // Search query filter (using debounced value)
            if (!table.debouncedSearchQuery) { return true; }
            const query = table.debouncedSearchQuery.toLowerCase();
            return user.id.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.full_name?.toLowerCase().includes(query) || user.role.toLowerCase().includes(query);
        });

        return sortData(filtered, table.sortField as keyof User, table.sortDirection, (item, field) => {
            if (field === 'created_at') { return new Date(item.created_at).getTime(); }
            return item[field as keyof User] as string;
        });
    }, [users, table.debouncedSearchQuery, table.filters, table.sortField, table.sortDirection]);

    // Paginated data
    const paginatedUsers = table.getPaginatedData(filteredAndSortedUsers);
    const totalPages = table.getTotalPages(filteredAndSortedUsers.length);

    // Handlers
    const handleCreateUser = async () => {
        if (!createForm.form.email) {
            toast.error('Email is required');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(createForm.form.email)) {
            toast.error('Invalid email format');
            return;
        }

        const tempPassword = generateTempPassword(createForm.form.email);
        const email = createForm.form.email;
        const fullName = createForm.form.full_name || getDefaultFullName(email);
        const role = createForm.form.role;

        await submit(async () => {
            const safeRole: 'user' | 'admin' = role === 'root' ? 'user' : role;
            const result = await createUser({
                email,
                password: tempPassword,
                full_name: fullName,
                role: safeRole
            });

            if (!result.success) {
                toast.error('Failed to create user', { description: result.error });
                throw new Error(result.error);
            }

            toast.success('User created successfully', {
                description: `Created user ${email}. Temporary password: ${tempPassword}`
            });

            createDialog.close();
            createForm.reset();
            fetchData();
        });
    };

    const handleEditUser = async () => {
        if (!editDialog.selectedItem) { return; }

        await submit(async () => {
            const { error } = await supabase.from('users').update({ full_name: editForm.form.full_name }).eq('id', editDialog.selectedItem!.id);

            if (error) {
                toast.error('Failed to update user', { description: error.message });
                return;
            }

            toast.success('User updated successfully');
            editDialog.close();
            fetchData();
        });
    };

    const handleChangeRole = async () => {
        if (!roleDialog.selectedItem) { return; }

        await submit(async () => {
            const { error } = await supabase.from('users').update({ role: roleForm.form.role }).eq('id', roleDialog.selectedItem!.id);

            if (error) {
                toast.error('Failed to change role', { description: error.message });
                return;
            }

            toast.success('Role changed successfully', { description: `${roleDialog.selectedItem!.email} is now ${roleForm.form.role}` });
            roleDialog.close();
            fetchData();
        });
    };

    const handleResetPassword = async () => {
        if (!passwordDialog.selectedItem || !passwordForm.form.password) { return; }

        if (passwordForm.form.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        await submit(async () => {
            const result = await resetUserPassword(passwordDialog.selectedItem!.id, passwordForm.form.password);

            if (!result.success) {
                toast.error('Failed to reset password', { description: result.error });
                throw new Error(result.error);
            }

            toast.success('Password reset successfully');
            passwordDialog.close();
            passwordForm.reset();
        });
    };

    const handleDeleteUser = async () => {
        if (!deleteDialog.selectedItem) { return; }

        const user = deleteDialog.selectedItem;

        try {
            const result = await deleteUser(user.id);

            if (!result.success) {
                toast.error('Failed to delete user', { description: result.error });
                return;
            }

            toast.success('User deleted', { description: `Deleted ${user.email}` });
            deleteDialog.close();
            fetchData();
        } catch (error) {
            logger.error('Error deleting user:', error);
            toast.error('An unexpected error occurred');
        }
    };

    const handleToggleUserActive = async () => {
        if (!toggleActiveDialog.selectedItem) { return; }

        const user = toggleActiveDialog.selectedItem;
        const newStatus = !user.is_active;
        const action = newStatus ? 'enable' : 'disable';

        try {
            const result = await toggleUserActive(user.id, newStatus);

            if (!result.success) {
                toast.error(`Failed to ${action} user`, { description: result.error });
                return;
            }

            toast.success(`User ${newStatus ? 'enabled' : 'disabled'}`, {
                description: `${user.email} access has been ${newStatus ? 'enabled' : 'disabled'}`
            });
            toggleActiveDialog.close();
            fetchData();
        } catch (error) {
            logger.error('Error toggling user active status:', error);
            toast.error('An unexpected error occurred');
        }
    };

    const openEditDialog = (user: User) => {
        editForm.reset({ full_name: user.full_name || '' });
        editDialog.open(user);
    };

    const openRoleDialog = (user: User) => {
        roleForm.reset({ role: user.role });
        roleDialog.open(user);
    };

    const openPasswordDialog = (user: User) => {
        passwordForm.reset({ password: '' });
        passwordDialog.open(user);
    };

    // Helper for sort handler
    const handleSort = (field: string) => table.toggleSort(field as SortField);

    // Table columns
    const columns: Column<User>[] = [
        {
            key: 'id',
            header: (
                <SortableHeader field="id" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          ID
                </SortableHeader>
            ),
            render: (user) => <CopyableId id={user.id} />
        },
        {
            key: 'name',
            header: (
                <SortableHeader field="full_name" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Name
                </SortableHeader>
            ),
            render: (user) => (
                <span className="font-medium">
                    {user.full_name || '—'}
                    {currentUser?.id === user.id && (
                        <Badge variant="outline" className="ml-2">
              You
                        </Badge>
                    )}
                </span>
            )
        },
        {
            key: 'email',
            header: (
                <SortableHeader field="email" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Email
                </SortableHeader>
            ),
            render: (user) => user.email
        },
        {
            key: 'role',
            header: (
                <SortableHeader field="role" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Role
                </SortableHeader>
            ),
            render: (user) => <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
        },
        {
            key: 'status',
            header: 'Status',
            render: (user) => <Badge variant={getStatusBadgeVariant(user.is_active)}>{user.is_active ? 'Active' : 'Disabled'}</Badge>
        },
        {
            key: 'created',
            header: (
                <SortableHeader field="created_at" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Created
                </SortableHeader>
            ),
            render: (user) => new Date(user.created_at).toLocaleDateString()
        }
    ];

    // Table actions
    const actions: Action<User>[] = [
        { label: 'Edit', icon: Pencil, onClick: openEditDialog, show: canManageUser },
        { label: 'Change Role', icon: UserCog, onClick: openRoleDialog, show: (u) => canChangeRoles && canManageUser(u) },
        { label: 'Reset Password', icon: Key, onClick: openPasswordDialog, show: canManageUser },
        {
            label: (u) => (u.is_active ? 'Disable Access' : 'Enable Access'),
            iconGetter: (u) => (u.is_active ? UserX : UserCheck),
            onClick: (u) => toggleActiveDialog.open(u),
            show: canManageUser,
            separator: true
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: (u) => deleteDialog.open(u),
            variant: 'destructive',
            show: (u) => canDeleteUsers && canManageUser(u)
        }
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Users"
                description="Manage system users and their permissions"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => fetchData()} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
                        </Button>
                        {canCreateUsers && (
                            <Button onClick={() => createDialog.open()}>
                                <Plus className="mr-2 h-4 w-4" />
                Add User
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Role Permissions Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
            Role Permissions
                    </CardTitle>
                    <CardDescription>Understanding the difference between user roles</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <Badge variant="destructive">root</Badge>
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Full system access</li>
                                <li>• Create, update, and delete all users</li>
                                <li>• Change user roles</li>
                                <li>• Manage all doors and tokens</li>
                                <li>• Export access logs</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <Badge variant="default">admin</Badge>
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Create new users (user role only)</li>
                                <li>• Manage users with lower role</li>
                                <li>• Assign and manage tokens</li>
                                <li>• Grant and revoke door access</li>
                                <li>• View access logs</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <Badge variant="secondary">user</Badge>
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Physical access only</li>
                                <li>• Use RFID tokens at doors</li>
                                <li>• No dashboard access</li>
                                <li>• Managed by admins</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <FilterCard>
                <FilterGrid>
                    <div className="md:col-span-2">
                        <SearchInput value={table.searchQuery} onChange={table.setSearchQuery} placeholder="Search by ID, email, name, or role..." />
                    </div>
                    <FilterRow>
                        <FilterSelect value={table.filters.role} onChange={(v) => table.setFilter('role', v)} options={ROLE_FILTER_OPTIONS} />
                        <FilterSelect value={table.filters.status} onChange={(v) => table.setFilter('status', v)} options={STATUS_FILTER_OPTIONS} />
                        <ClearFiltersButton onClick={table.clearFilters} show={table.hasActiveFilters} />
                    </FilterRow>
                </FilterGrid>
            </FilterCard>

            {/* Users Table */}
            <DataTable
                title="All Users"
                description={`${filteredAndSortedUsers.length} użytkowników${filteredAndSortedUsers.length !== users.length ? ` (${users.length} łącznie)` : ''}`}
                columns={columns}
                data={paginatedUsers}
                actions={actions}
                isLoading={isLoading}
                loadingMessage="Loading users..."
                keyExtractor={(user) => user.id}
                pagination={{
                    currentPage: table.currentPage,
                    totalPages,
                    pageSize: table.pageSize,
                    totalItems: filteredAndSortedUsers.length,
                    onPageChange: table.handlePageChange,
                    onPageSizeChange: table.handlePageSizeChange
                }}
            />

            {/* Create User Dialog */}
            <FormDialog open={createDialog.isOpen} onOpenChange={(open) => !open && createDialog.close()} title="Create New User" description="Add a new user to the system" onSubmit={handleCreateUser} submitLabel="Create User" submitLoadingLabel="Creating..." isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="user@example.com" value={createForm.form.email} onChange={(e) => createForm.updateField('email', e.target.value)} />
                    {createForm.form.email && (
                        <p className="text-xs text-muted-foreground">
              Temporary password will be: <code className="bg-muted px-1 py-0.5 rounded">{generateTempPassword(createForm.form.email)}</code>
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" placeholder={createForm.form.email ? getDefaultFullName(createForm.form.email) : 'John Doe'} value={createForm.form.full_name} onChange={(e) => createForm.updateField('full_name', e.target.value)} />
                    {createForm.form.email && !createForm.form.full_name && (
                        <p className="text-xs text-muted-foreground">
              Default: <code className="bg-muted px-1 py-0.5 rounded">{getDefaultFullName(createForm.form.email)}</code>
                        </p>
                    )}
                </div>
                {canChangeRoles && (
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={createForm.form.role} onValueChange={(value: UserRole) => createForm.updateField('role', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">User: Physical access only. Admin: Can manage users and access.</p>
                    </div>
                )}
            </FormDialog>

            {/* Edit User Dialog */}
            <FormDialog open={editDialog.isOpen} onOpenChange={(open) => !open && editDialog.close()} title="Edit User" description={`Update user information for ${editDialog.selectedItem?.email}`} onSubmit={handleEditUser} submitLabel="Save Changes" submitLoadingLabel="Saving..." isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="edit_full_name">Full Name</Label>
                    <Input id="edit_full_name" placeholder="John Doe" value={editForm.form.full_name} onChange={(e) => editForm.updateField('full_name', e.target.value)} />
                </div>
            </FormDialog>

            {/* Change Role Dialog */}
            <FormDialog open={roleDialog.isOpen} onOpenChange={(open) => !open && roleDialog.close()} title="Change User Role" description={`Change the role for ${roleDialog.selectedItem?.email}`} onSubmit={handleChangeRole} submitLabel="Change Role" submitLoadingLabel="Changing..." isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="new_role">New Role</Label>
                    <Select value={roleForm.form.role} onValueChange={(value: UserRole) => roleForm.updateField('role', value)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Note: Only root users can change roles. You cannot assign the root role to other users.</p>
                </div>
            </FormDialog>

            {/* Reset Password Dialog */}
            <FormDialog open={passwordDialog.isOpen} onOpenChange={(open) => !open && passwordDialog.close()} title="Reset Password" description={`Set a new password for ${passwordDialog.selectedItem?.email}`} onSubmit={handleResetPassword} submitLabel="Reset Password" submitLoadingLabel="Resetting..." isSubmitting={isSubmitting}>
                <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <Input id="new_password" type="password" placeholder="••••••••" value={passwordForm.form.password} onChange={(e) => passwordForm.updateField('password', e.target.value)} />
                    <p className="text-xs text-muted-foreground">Password must be at least 6 characters long.</p>
                </div>
            </FormDialog>

            {/* Delete User Confirm Dialog */}
            <ConfirmDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && deleteDialog.close()} title="Delete User" description={`Are you sure you want to delete ${deleteDialog.selectedItem?.email}? This action cannot be undone.`} onConfirm={handleDeleteUser} confirmLabel="Delete" variant="destructive" />

            {/* Toggle User Active Confirm Dialog */}
            <ConfirmDialog open={toggleActiveDialog.isOpen} onOpenChange={(open) => !open && toggleActiveDialog.close()} title={toggleActiveDialog.selectedItem?.is_active ? 'Disable User Access' : 'Enable User Access'} description={toggleActiveDialog.selectedItem?.is_active ? `Are you sure you want to disable access for ${toggleActiveDialog.selectedItem?.email}? They will not be able to use their RFID tokens.` : `Are you sure you want to enable access for ${toggleActiveDialog.selectedItem?.email}? They will be able to use their RFID tokens again.`} onConfirm={handleToggleUserActive} confirmLabel={toggleActiveDialog.selectedItem?.is_active ? 'Disable' : 'Enable'} variant={toggleActiveDialog.selectedItem?.is_active ? 'destructive' : 'default'} />
        </div>
    );
}
