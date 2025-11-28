'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface UseCrudOptions<T> {
  table: string;
  orderBy?: { column: string; ascending?: boolean };
  select?: string;
  transform?: (data: any[]) => T[];
}

interface UseCrudReturn<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  fetchData: () => Promise<void>;
  create: (item: Partial<T>) => Promise<boolean>;
  update: (id: string, item: Partial<T>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useCrud<T extends { id: string }>({ table, orderBy = { column: 'created_at', ascending: false }, select = '*', transform }: UseCrudOptions<T>): UseCrudReturn<T> {
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const query = supabase
                .from(table)
                .select(select)
                .order(orderBy.column, { ascending: orderBy.ascending ?? false });

            const { data: result, error: fetchError } = await query;

            if (fetchError) {
                throw fetchError;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedData = transform ? transform(result || []) : (((result as any) || []) as T[]);
            setData(transformedData);
        } catch (err) {
            logger.error(`Error fetching ${table}:`, err);
            setError(err as Error);
            toast.error(`Failed to fetch ${table}`);
        } finally {
            setIsLoading(false);
        }
    }, [table, select, orderBy.column, orderBy.ascending, transform]);

    const create = useCallback(
        async (item: Partial<T>): Promise<boolean> => {
            try {
                const { error: createError } = await supabase.from(table).insert(item);

                if (createError) {
                    if (createError.code === '23505') {
                        toast.error('Item already exists');
                    } else {
                        toast.error('Failed to create item', { description: createError.message });
                    }
                    return false;
                }

                toast.success('Created successfully');
                await fetchData();
                return true;
            } catch (err) {
                logger.error(`Error creating ${table}:`, err);
                toast.error('An unexpected error occurred');
                return false;
            }
        },
        [table, fetchData]
    );

    const update = useCallback(
        async (id: string, item: Partial<T>): Promise<boolean> => {
            try {
                const { error: updateError } = await supabase.from(table).update(item).eq('id', id);

                if (updateError) {
                    toast.error('Failed to update', { description: updateError.message });
                    return false;
                }

                toast.success('Updated successfully');
                await fetchData();
                return true;
            } catch (err) {
                logger.error(`Error updating ${table}:`, err);
                toast.error('An unexpected error occurred');
                return false;
            }
        },
        [table, fetchData]
    );

    const remove = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                const { error: deleteError } = await supabase.from(table).delete().eq('id', id);

                if (deleteError) {
                    toast.error('Failed to delete', { description: deleteError.message });
                    return false;
                }

                toast.success('Deleted successfully');
                await fetchData();
                return true;
            } catch (err) {
                logger.error(`Error deleting ${table}:`, err);
                toast.error('An unexpected error occurred');
                return false;
            }
        },
        [table, fetchData]
    );

    return {
        data,
        isLoading,
        error,
        fetchData,
        create,
        update,
        remove
    };
}

// Hook for managing dialog state
interface UseDialogReturn<T> {
  isOpen: boolean;
  selectedItem: T | null;
  open: (item?: T) => void;
  close: () => void;
}

export function useDialog<T>(): UseDialogReturn<T> {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<T | null>(null);

    const open = useCallback((item?: T) => {
        setSelectedItem(item || null);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setSelectedItem(null);
    }, []);

    return {
        isOpen,
        selectedItem,
        open,
        close
    };
}

// Hook for form state
interface UseFormReturn<T> {
  form: T;
  setForm: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  reset: (initialValues?: T) => void;
}

export function useForm<T>(initialValues: T): UseFormReturn<T> {
    const [form, setForm] = useState<T>(initialValues);

    const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    }, []);

    const reset = useCallback(
        (values?: T) => {
            setForm(values || initialValues);
        },
        [initialValues]
    );

    return {
        form,
        setForm,
        updateField,
        reset
    };
}

// Hook for submission state
interface UseSubmitReturn {
  isSubmitting: boolean;
  submit: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

export function useSubmit(): UseSubmitReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
        setIsSubmitting(true);
        try {
            return await fn();
        } finally {
            setIsSubmitting(false);
        }
    }, []);

    return {
        isSubmitting,
        submit
    };
}
