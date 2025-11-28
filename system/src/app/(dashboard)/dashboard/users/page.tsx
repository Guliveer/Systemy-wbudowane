'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Shield, UserCog, Key, Search, Copy, Check, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/lib/logger';
import { createUser, deleteUser, resetUserPassword } from './actions';
import { PageHeader, DataTable, FormDialog } from '@/components/dashboard';
import { useCrud, useDialog, useForm, useSubmit } from '@/hooks/use-crud';
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

// Helper function to generate temporary password from email
const generateTempPassword = (email: string): string => {
    const localPart = email.split('@')[0];
    const currentYear = new Date().getFullYear();
    return `${localPart}${currentYear}`;
};

// Helper function to get default full name from email
const getDefaultFullName = (email: string): string => {
    return email.split('@')[0];
};

const initialEditForm: EditUserForm = { full_name: '' };

// Copy to clipboard component
const CopyableId = ({ id }: { id: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            toast.success('ID copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy ID');
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
};

// Helper functions
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

type SortField = 'id' | 'full_name' | 'email' | 'role' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const supabase = createClient();
    const { data: users, isLoading, fetchData } = useCrud<User>({ table: 'users' });
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const createDialog = useDialog<User>();
    const editDialog = useDialog<User>();
    const roleDialog = useDialog<User>();
    const passwordDialog = useDialog<User>();

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
        if (!currentUser) {
            return false;
        }
        if (currentUser.id === targetUser.id) {
            return false;
        }
        return canManageRole(currentUserRole, targetUser.role);
    };

    // Handlers
    const handleCreateUser = async () => {
        if (!createForm.form.email) {
            toast.error('Email is required');
            return;
        }

        // Validate email format
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
            // Use Server Action to create user (doesn't log out current user)
            // Note: root role cannot be assigned when creating users
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

            // Close dialog and reset form
            createDialog.close();
            createForm.reset();
            fetchData();
        });
    };

    const handleEditUser = async () => {
        if (!editDialog.selectedItem) {
            return;
        }

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
        if (!roleDialog.selectedItem) {
            return;
        }

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
        if (!passwordDialog.selectedItem || !passwordForm.form.password) {
            return;
        }

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

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`Are you sure you want to delete ${user.email}?`)) {
            return;
        }

        try {
            const result = await deleteUser(user.id);

            if (!result.success) {
                toast.error('Failed to delete user', { description: result.error });
                return;
            }

            toast.success('User deleted', { description: `Deleted ${user.email}` });
            fetchData();
        } catch (error) {
            logger.error('Error deleting user:', error);
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

    // Filter and sort users
    const filteredAndSortedUsers = useMemo(() => {
    // First filter
        const filtered = users.filter((user) => {
            // Role filter
            if (roleFilter !== 'all' && user.role !== roleFilter) { return false; }

            // Search query filter
            if (!searchQuery) { return true; }
            const query = searchQuery.toLowerCase();
            return user.id.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.full_name?.toLowerCase().includes(query) || user.role.toLowerCase().includes(query);
        });

        // Then sort
        const sorted = [...filtered].sort((a, b) => {
            let aValue: string | number = '';
            let bValue: string | number = '';

            switch (sortField) {
                case 'id':
                    aValue = a.id;
                    bValue = b.id;
                    break;
                case 'full_name':
                    aValue = a.full_name || '';
                    bValue = b.full_name || '';
                    break;
                case 'email':
                    aValue = a.email;
                    bValue = b.email;
                    break;
                case 'role':
                    aValue = a.role;
                    bValue = b.role;
                    break;
                case 'created_at':
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    break;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
        });

        return sorted;
    }, [users, searchQuery, roleFilter, sortField, sortDirection]);

    // Paginated users
    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredAndSortedUsers.slice(startIndex, startIndex + pageSize);
    }, [filteredAndSortedUsers, pageSize, currentPage]);

    // Total pages
    const totalPages = useMemo(() => {
        return Math.ceil(filteredAndSortedUsers.length / pageSize);
    }, [filteredAndSortedUsers.length, pageSize]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, roleFilter, pageSize]);

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
        setRoleFilter('all');
        setSortField('created_at');
        setSortDirection('desc');
    };

    const hasActiveFilters = searchQuery || roleFilter !== 'all';

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
        if (sortField !== field) { return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />; }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
    };

    // Table columns
    const columns: Column<User>[] = [
        {
            key: 'id',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('id')}>
          ID <SortIcon field="id" />
                </button>
            ),
            render: (user) => <CopyableId id={user.id} />
        },
        {
            key: 'name',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('full_name')}>
          Name <SortIcon field="full_name" />
                </button>
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
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('email')}>
          Email <SortIcon field="email" />
                </button>
            ),
            render: (user) => user.email
        },
        {
            key: 'role',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('role')}>
          Role <SortIcon field="role" />
                </button>
            ),
            render: (user) => <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
        },
        {
            key: 'created',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('created_at')}>
          Created <SortIcon field="created_at" />
                </button>
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
            label: 'Delete',
            icon: Trash2,
            onClick: handleDeleteUser,
            variant: 'destructive',
            separator: true,
            show: (u) => canDeleteUsers && canManageUser(u)
        }
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Users"
                description="Manage system users and their permissions"
                actions={
                    canCreateUsers && (
                        <Button onClick={() => createDialog.open()}>
                            <Plus className="mr-2 h-4 w-4" />
              Add User
                        </Button>
                    )
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
                                <Input placeholder="Search by ID, email, name, or role..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <Select value={roleFilter} onValueChange={(value: 'all' | UserRole) => setRoleFilter(value)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="root">Root</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="user">User</SelectItem>
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
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems: filteredAndSortedUsers.length,
                    onPageChange: handlePageChange,
                    onPageSizeChange: handlePageSizeChange
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
        </div>
    );
}
