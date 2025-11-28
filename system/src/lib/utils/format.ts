/**
 * Format utilities for dates and times
 */

/**
 * Get relative time string from a date
 */
export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) { return 'Just now'; }
    if (diffMins < 60) { return `${diffMins}m ago`; }
    if (diffHours < 24) { return `${diffHours}h ago`; }
    if (diffDays < 7) { return `${diffDays}d ago`; }
    return date.toLocaleDateString();
}

/**
 * Format timestamp to date and time parts
 */
export function formatTimestamp(timestamp: string): {
  date: string;
  time: string;
  relative: string;
} {
    const date = new Date(timestamp);
    return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        relative: getRelativeTime(date)
    };
}

/**
 * Format last used time
 */
export function formatLastUsed(lastUsed: string | null): string {
    if (!lastUsed) { return 'Never'; }
    const date = new Date(lastUsed);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) { return 'Less than an hour ago'; }
    if (diffHours < 24) { return `${diffHours} hours ago`; }
    if (diffDays < 7) { return `${diffDays} days ago`; }
    return date.toLocaleDateString();
}

/**
 * Check if a date is expired
 */
export function isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) { return false; }
    return new Date(expiresAt) < new Date();
}

/**
 * Format expiry date
 */
export function formatExpiry(expiresAt: string | null): string {
    if (!expiresAt) { return 'Never'; }
    const date = new Date(expiresAt);
    if (isExpired(expiresAt)) { return `Expired ${date.toLocaleDateString()}`; }
    return date.toLocaleDateString();
}

/**
 * Get date filter range
 */
export function getDateFilterRange(filter: string): Date | null {
    const now = new Date();
    switch (filter) {
        case 'today':
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        case 'week':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return weekAgo;
        case 'month':
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return monthAgo;
        case 'year':
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return yearAgo;
        default:
            return null;
    }
}
