'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, ScanLine, Power, PowerOff, LogIn, LogOut, ArrowLeftRight, Search, Copy, Check, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, StatCard, StatCardsGrid, DataTable, FormDialog } from '@/components/dashboard';
import { useCrud, useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import type { Scanner, ReaderType } from '@/types/database';
import type { Column, Action } from '@/components/dashboard/data-table';

// Form types
interface ScannerForm {
  name: string;
  location: string;
  description: string;
  reader_type: ReaderType;
}

const initialScannerForm: ScannerForm = {
    name: '',
    location: '',
    description: '',
    reader_type: 'both'
};

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
const getReaderTypeIcon = (type: ReaderType) => {
    switch (type) {
        case 'entry':
            return <LogIn className="h-4 w-4" />;
        case 'exit':
            return <LogOut className="h-4 w-4" />;
        default:
            return <ArrowLeftRight className="h-4 w-4" />;
    }
};

const getReaderTypeLabel = (type: ReaderType) => {
    switch (type) {
        case 'entry':
            return 'Entry';
        case 'exit':
            return 'Exit';
        default:
            return 'Both';
    }
};

type SortField = 'id' | 'name' | 'location' | 'reader_type' | 'is_active' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function ScannersPage() {
    const { user: currentUser } = useAuth();
    const { data: scanners, isLoading, fetchData, create, update, remove } = useCrud<Scanner>({ table: 'scanners' });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [readerTypeFilter, setReaderTypeFilter] = useState<'all' | ReaderType>('all');
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const createDialog = useDialog<Scanner>();
    const editDialog = useDialog<Scanner>();
    const createForm = useForm<ScannerForm>(initialScannerForm);
    const editForm = useForm<ScannerForm>(initialScannerForm);
    const { isSubmitting, submit } = useSubmit();

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Permissions
    const currentUserRole = currentUser?.role || 'user';
    const canCreateScanners = currentUserRole === 'root';
    const canEditScanners = currentUserRole === 'root';
    const canDeleteScanners = currentUserRole === 'root';

    // Handlers
    const handleCreate = async () => {
        if (!createForm.form.name || !createForm.form.location) {
            return;
        }

        const success = await submit(() =>
            create({
                name: createForm.form.name,
                location: createForm.form.location,
                description: createForm.form.description || null,
                reader_type: createForm.form.reader_type,
                is_active: true
            } as Partial<Scanner>)
        );

        if (success) {
            createDialog.close();
            createForm.reset();
        }
    };

    const handleEdit = async () => {
        if (!editDialog.selectedItem) {
            return;
        }

        const success = await submit(() =>
            update(editDialog.selectedItem!.id, {
                name: editForm.form.name,
                location: editForm.form.location,
                description: editForm.form.description || null,
                reader_type: editForm.form.reader_type
            })
        );

        if (success) {
            editDialog.close();
        }
    };

    const handleToggleStatus = async (scanner: Scanner) => {
        await update(scanner.id, { is_active: !scanner.is_active });
    };

    const handleDelete = async (scanner: Scanner) => {
        if (!confirm(`Are you sure you want to delete "${scanner.name}"?`)) {
            return;
        }
        await remove(scanner.id);
    };

    const openEditDialog = (scanner: Scanner) => {
        editForm.reset({
            name: scanner.name,
            location: scanner.location,
            description: scanner.description || '',
            reader_type: scanner.reader_type || 'both'
        });
        editDialog.open(scanner);
    };

    // Filter and sort scanners
    const filteredAndSortedScanners = useMemo(() => {
    // First filter
        const filtered = scanners.filter((scanner) => {
            // Status filter
            if (statusFilter === 'active' && !scanner.is_active) {
                return false;
            }
            if (statusFilter === 'inactive' && scanner.is_active) {
                return false;
            }

            // Reader type filter
            if (readerTypeFilter !== 'all' && scanner.reader_type !== readerTypeFilter) {
                return false;
            }

            // Search query filter
            if (!searchQuery) {
                return true;
            }
            const query = searchQuery.toLowerCase();
            return scanner.id.toLowerCase().includes(query) || scanner.name.toLowerCase().includes(query) || scanner.location.toLowerCase().includes(query) || scanner.description?.toLowerCase().includes(query) || (scanner.reader_type || 'both').toLowerCase().includes(query);
        });

        // Then sort
        const sorted = [...filtered].sort((a, b) => {
            let aValue: string | number | boolean = '';
            let bValue: string | number | boolean = '';

            switch (sortField) {
                case 'id':
                    aValue = a.id;
                    bValue = b.id;
                    break;
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'location':
                    aValue = a.location;
                    bValue = b.location;
                    break;
                case 'reader_type':
                    aValue = a.reader_type || 'both';
                    bValue = b.reader_type || 'both';
                    break;
                case 'is_active':
                    aValue = a.is_active ? 1 : 0;
                    bValue = b.is_active ? 1 : 0;
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
    }, [scanners, searchQuery, statusFilter, readerTypeFilter, sortField, sortDirection]);

    // Paginated scanners
    const paginatedScanners = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredAndSortedScanners.slice(startIndex, startIndex + pageSize);
    }, [filteredAndSortedScanners, pageSize, currentPage]);

    // Total pages
    const totalPages = useMemo(() => {
        return Math.ceil(filteredAndSortedScanners.length / pageSize);
    }, [filteredAndSortedScanners.length, pageSize]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, readerTypeFilter, pageSize]);

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
        setReaderTypeFilter('all');
        setSortField('name');
        setSortDirection('asc');
    };

    const hasActiveFilters = searchQuery || statusFilter !== 'all' || readerTypeFilter !== 'all';

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

    // Table columns
    const columns: Column<Scanner>[] = [
        {
            key: 'id',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('id')}>
          ID <SortIcon field="id" />
                </button>
            ),
            render: (scanner) => <CopyableId id={scanner.id} />
        },
        {
            key: 'name',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('name')}>
          Name <SortIcon field="name" />
                </button>
            ),
            render: (scanner) => <span className="font-medium">{scanner.name}</span>
        },
        {
            key: 'location',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('location')}>
          Location <SortIcon field="location" />
                </button>
            ),
            render: (scanner) => scanner.location
        },
        {
            key: 'reader_type',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('reader_type')}>
          Reader Type <SortIcon field="reader_type" />
                </button>
            ),
            render: (scanner) => (
                <Badge variant="secondary" className="gap-1">
                    {getReaderTypeIcon(scanner.reader_type || 'both')}
                    {getReaderTypeLabel(scanner.reader_type || 'both')}
                </Badge>
            )
        },
        {
            key: 'description',
            header: 'Description',
            render: (scanner) => <span className="text-muted-foreground">{scanner.description || '—'}</span>
        },
        {
            key: 'status',
            header: (
                <button className="inline-flex items-center hover:text-foreground" onClick={() => toggleSort('is_active')}>
          Status <SortIcon field="is_active" />
                </button>
            ),
            render: (scanner) => (
                <Badge variant={scanner.is_active ? 'default' : 'secondary'} className={scanner.is_active ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                    {scanner.is_active ? 'Active' : 'Inactive'}
                </Badge>
            )
        }
    ];

    // Table actions
    const actions: Action<Scanner>[] = [
        {
            label: 'Edit',
            icon: Pencil,
            onClick: openEditDialog,
            show: () => canEditScanners
        },
        {
            label: 'Deactivate',
            icon: PowerOff,
            onClick: handleToggleStatus,
            show: (scanner) => canEditScanners && scanner.is_active
        },
        {
            label: 'Activate',
            icon: Power,
            onClick: handleToggleStatus,
            show: (scanner) => canEditScanners && !scanner.is_active
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: handleDelete,
            variant: 'destructive',
            separator: true,
            show: () => canDeleteScanners
        }
    ];

    // Form fields component
    const ScannerFormFields = ({ form, updateField }: { form: ScannerForm; updateField: (field: keyof ScannerForm, value: string) => void }) => (
        <>
            <div className="space-y-2">
                <Label htmlFor="name">Scanner Name</Label>
                <Input id="name" placeholder="e.g., Main Entrance" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="e.g., Building A, Floor 1" value={form.location} onChange={(e) => updateField('location', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input id="description" placeholder="Additional details about this scanner" value={form.description} onChange={(e) => updateField('description', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="reader_type">Reader Type</Label>
                <Select value={form.reader_type} onValueChange={(value: ReaderType) => updateField('reader_type', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select reader type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="entry">
                            <div className="flex items-center gap-2">
                                <LogIn className="h-4 w-4" />
                Entry Only
                            </div>
                        </SelectItem>
                        <SelectItem value="exit">
                            <div className="flex items-center gap-2">
                                <LogOut className="h-4 w-4" />
                Exit Only
                            </div>
                        </SelectItem>
                        <SelectItem value="both">
                            <div className="flex items-center gap-2">
                                <ArrowLeftRight className="h-4 w-4" />
                Both (Entry & Exit)
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Specify whether this reader is used for entry, exit, or both directions</p>
            </div>
        </>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Scanners"
                description="Manage access points and scanner configurations"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => fetchData()} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
                        </Button>
                        {canCreateScanners && (
                            <Button onClick={() => createDialog.open()}>
                                <Plus className="mr-2 h-4 w-4" />
                Add Scanner
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Statistics */}
            <StatCardsGrid columns={4}>
                <StatCard title="Total Scanners" value={scanners.length} description="Configured access points" icon={ScanLine} />
                <StatCard title="Active" value={scanners.filter((d) => d.is_active).length} description="Currently operational" icon={ScanLine} iconClassName="text-green-500" />
                <StatCard title="Entry Readers" value={scanners.filter((d) => d.reader_type === 'entry' || d.reader_type === 'both').length} description="Entry-capable scanners" icon={LogIn} iconClassName="text-blue-500" />
                <StatCard title="Exit Readers" value={scanners.filter((d) => d.reader_type === 'exit' || d.reader_type === 'both').length} description="Exit-capable scanners" icon={LogOut} iconClassName="text-orange-500" />
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
                                <Input placeholder="Search by ID, name, location, or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={readerTypeFilter} onValueChange={(value: 'all' | ReaderType) => setReaderTypeFilter(value)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Reader Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="entry">Entry</SelectItem>
                                    <SelectItem value="exit">Exit</SelectItem>
                                    <SelectItem value="both">Both</SelectItem>
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

            {/* Scanners Table */}
            <DataTable
                title="All Scanners"
                description={`${filteredAndSortedScanners.length} skanerów${filteredAndSortedScanners.length !== scanners.length ? ` (${scanners.length} łącznie)` : ''}`}
                columns={columns}
                data={paginatedScanners}
                actions={actions}
                isLoading={isLoading}
                loadingMessage="Loading scanners..."
                emptyMessage="No scanners configured yet"
                keyExtractor={(scanner) => scanner.id}
                pagination={{
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems: filteredAndSortedScanners.length,
                    onPageChange: handlePageChange,
                    onPageSizeChange: handlePageSizeChange
                }}
            />

            {/* Create Dialog */}
            <FormDialog open={createDialog.isOpen} onOpenChange={(open) => !open && createDialog.close()} title="Add New Scanner" description="Configure a new access point in the system" onSubmit={handleCreate} submitLabel="Add Scanner" submitLoadingLabel="Creating..." isSubmitting={isSubmitting}>
                <ScannerFormFields form={createForm.form} updateField={createForm.updateField} />
            </FormDialog>

            {/* Edit Dialog */}
            <FormDialog open={editDialog.isOpen} onOpenChange={(open) => !open && editDialog.close()} title="Edit Scanner" description="Update scanner configuration" onSubmit={handleEdit} submitLabel="Save Changes" submitLoadingLabel="Saving..." isSubmitting={isSubmitting}>
                <ScannerFormFields form={editForm.form} updateField={editForm.updateField} />
            </FormDialog>
        </div>
    );
}
