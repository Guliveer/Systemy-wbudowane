'use client';

import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ScanLine, Power, PowerOff, LogIn, LogOut, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, StatCard, StatCardsGrid, DataTable, FormDialog, CopyableId, SortableHeader, FilterCard, SearchInput, FilterSelect, ClearFiltersButton, FilterGrid, FilterRow, STATUS_FILTER_OPTIONS } from '@/components/dashboard';
import { useCrud, useDialog, useForm, useSubmit } from '@/hooks/use-crud';
import { useTable, sortData } from '@/hooks/use-table';
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

const READER_TYPE_OPTIONS = [
    { value: 'all', label: 'All Types' },
    { value: 'entry', label: 'Entry' },
    { value: 'exit', label: 'Exit' },
    { value: 'both', label: 'Both' }
];

type SortField = 'id' | 'name' | 'location' | 'reader_type' | 'is_active' | 'created_at';
type FilterState = { status: string; readerType: string };

export default function ScannersPage() {
    const { user: currentUser } = useAuth();
    const { data: scanners, isLoading, fetchData, create, update, remove } = useCrud<Scanner>({ table: 'scanners' });

    const table = useTable<SortField, FilterState>({
        sort: { defaultField: 'name', defaultDirection: 'asc' },
        filter: { defaultFilters: { status: 'all', readerType: 'all' } }
    });

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

    // Filter and sort scanners (using debouncedSearchQuery for performance)
    const filteredAndSortedScanners = useMemo(() => {
        const filtered = scanners.filter((scanner) => {
            // Status filter
            if (table.filters.status === 'active' && !scanner.is_active) { return false; }
            if (table.filters.status === 'disabled' && scanner.is_active) { return false; }

            // Reader type filter
            if (table.filters.readerType !== 'all' && scanner.reader_type !== table.filters.readerType) { return false; }

            // Search query filter (using debounced value)
            if (!table.debouncedSearchQuery) { return true; }
            const query = table.debouncedSearchQuery.toLowerCase();
            return scanner.id.toLowerCase().includes(query) || scanner.name.toLowerCase().includes(query) || scanner.location.toLowerCase().includes(query) || scanner.description?.toLowerCase().includes(query);
        });

        return sortData(filtered, table.sortField as keyof Scanner, table.sortDirection, (item, field) => {
            if (field === 'reader_type') { return item.reader_type || 'both'; }
            if (field === 'is_active') { return item.is_active ? 1 : 0; }
            if (field === 'created_at') { return new Date(item.created_at).getTime(); }
            return item[field as keyof Scanner] as string;
        });
    }, [scanners, table.debouncedSearchQuery, table.filters, table.sortField, table.sortDirection]);

    // Paginated data
    const paginatedScanners = table.getPaginatedData(filteredAndSortedScanners);
    const totalPages = table.getTotalPages(filteredAndSortedScanners.length);

    // Handlers
    const handleCreate = async () => {
        if (!createForm.form.name || !createForm.form.location) { return; }

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
        if (!editDialog.selectedItem) { return; }

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
        if (!confirm(`Are you sure you want to delete "${scanner.name}"?`)) { return; }
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

    // Helper for sort handler with proper typing
    const handleSort = (field: string) => table.toggleSort(field as SortField);

    // Table columns
    const columns: Column<Scanner>[] = [
        {
            key: 'id',
            header: (
                <SortableHeader field="id" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          ID
                </SortableHeader>
            ),
            render: (scanner) => <CopyableId id={scanner.id} />
        },
        {
            key: 'name',
            header: (
                <SortableHeader field="name" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Name
                </SortableHeader>
            ),
            render: (scanner) => <span className="font-medium">{scanner.name}</span>
        },
        {
            key: 'location',
            header: (
                <SortableHeader field="location" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Location
                </SortableHeader>
            ),
            render: (scanner) => scanner.location
        },
        {
            key: 'reader_type',
            header: (
                <SortableHeader field="reader_type" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Reader Type
                </SortableHeader>
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
                <SortableHeader field="is_active" currentField={table.sortField} direction={table.sortDirection} onSort={handleSort}>
          Status
                </SortableHeader>
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
        { label: 'Edit', icon: Pencil, onClick: openEditDialog, show: () => canEditScanners },
        { label: 'Deactivate', icon: PowerOff, onClick: handleToggleStatus, show: (scanner) => canEditScanners && scanner.is_active },
        { label: 'Activate', icon: Power, onClick: handleToggleStatus, show: (scanner) => canEditScanners && !scanner.is_active },
        { label: 'Delete', icon: Trash2, onClick: handleDelete, variant: 'destructive', separator: true, show: () => canDeleteScanners }
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
            <FilterCard>
                <FilterGrid>
                    <div className="md:col-span-2">
                        <SearchInput value={table.searchQuery} onChange={table.setSearchQuery} placeholder="Search by ID, name, location, or description..." />
                    </div>
                    <FilterRow>
                        <FilterSelect value={table.filters.status} onChange={(v) => table.setFilter('status', v)} options={STATUS_FILTER_OPTIONS} />
                        <FilterSelect value={table.filters.readerType} onChange={(v) => table.setFilter('readerType', v)} options={READER_TYPE_OPTIONS} />
                        <ClearFiltersButton onClick={table.clearFilters} show={table.hasActiveFilters} />
                    </FilterRow>
                </FilterGrid>
            </FilterCard>

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
                    currentPage: table.currentPage,
                    totalPages,
                    pageSize: table.pageSize,
                    totalItems: filteredAndSortedScanners.length,
                    onPageChange: table.handlePageChange,
                    onPageSizeChange: table.handlePageSizeChange
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
