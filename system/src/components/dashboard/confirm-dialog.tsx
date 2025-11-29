'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', onConfirm, isLoading = false }: ConfirmDialogProps) {
    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm} disabled={isLoading} className={cn(variant === 'destructive' && buttonVariants({ variant: 'destructive' }))}>
                        {isLoading ? 'Loading...' : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// Hook for managing confirm dialog state
import { useState, useCallback } from 'react';

interface UseConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

interface UseConfirmDialogReturn<T> {
  isOpen: boolean;
  item: T | null;
  open: (item: T) => void;
  close: () => void;
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'destructive';
  };
}

export function useConfirmDialog<T>(options: UseConfirmDialogOptions): UseConfirmDialogReturn<T> {
    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState<T | null>(null);

    const open = useCallback((newItem: T) => {
        setItem(newItem);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setItem(null);
    }, []);

    return {
        isOpen,
        item,
        open,
        close,
        dialogProps: {
            open: isOpen,
            onOpenChange: (open: boolean) => {
                if (!open) { close(); }
            },
            ...options
        }
    };
}
