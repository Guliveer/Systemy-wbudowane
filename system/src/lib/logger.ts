/**
 * Development-only logger utility
 * Logs are only output when NODE_ENV is 'development'
 *
 * For production logs, use standard console.log/warn/error directly
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
    log: (...args: unknown[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    warn: (...args: unknown[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    error: (...args: unknown[]) => {
        if (isDev) {
            console.error(...args);
        }
    },

    // For debugging specific features - can be toggled
    debug: (feature: string, ...args: unknown[]) => {
        if (isDev) {
            console.log(`[${feature}]`, ...args);
        }
    }
};
