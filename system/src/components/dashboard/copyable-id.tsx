'use client';

import { useState, memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CopyableIdProps {
  id: string;
  label?: string;
  successMessage?: string;
  className?: string;
}

/**
 * Memoized component for displaying and copying IDs
 * Only re-renders when id, label, successMessage, or className changes
 */
export const CopyableId = memo(function CopyableId({ id, label = 'ID', successMessage, className = '' }: CopyableIdProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            toast.success(successMessage || `${label} skopiowane do schowka`);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error(`Nie udało się skopiować ${label}`);
        }
    }, [id, label, successMessage]);

    return (
        <div className={`inline-flex items-center gap-1 ${className}`}>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{id}</code>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
        </div>
    );
});

// Variant for RFID tokens
interface CopyableRfidProps {
  rfidUid: string;
  className?: string;
}

/**
 * Memoized component for displaying and copying RFID UIDs
 */
export const CopyableRfid = memo(function CopyableRfid({ rfidUid, className = '' }: CopyableRfidProps) {
    return <CopyableId id={rfidUid} label="RFID Token" successMessage="RFID Token skopiowany do schowka" className={className} />;
});
