'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  submitLoadingLabel?: string;
  isSubmitting?: boolean;
  trigger?: ReactNode;
}

export function FormDialog({ open, onOpenChange, title, description, children, onSubmit, submitLabel = 'Save', submitLoadingLabel = 'Saving...', isSubmitting = false, trigger }: FormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <div className="space-y-4 py-4">{children}</div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
                    </Button>
                    <Button onClick={onSubmit} disabled={isSubmitting}>
                        {isSubmitting ? submitLoadingLabel : submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Confirm dialog for delete actions
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
  isLoading?: boolean;
  variant?: 'default' | 'destructive';
}

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, confirmLabel = 'Confirm', confirmLoadingLabel = 'Processing...', isLoading = false, variant = 'destructive' }: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
                    </Button>
                    <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? confirmLoadingLabel : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
