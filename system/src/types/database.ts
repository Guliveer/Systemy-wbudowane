// Types for Supabase database structure
// These types represent the DB structure for the RFID access management system

export type UserRole = 'root' | 'admin' | 'user';
export type ReaderType = 'entry' | 'exit' | 'both';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scanner {
  id: string;
  name: string;
  location: string;
  description: string | null;
  is_active: boolean;
  reader_type: ReaderType; // Whether the reader is for entry, exit, or both
  created_at: string;
  updated_at: string;
}

// Alias for backward compatibility
export type Door = Scanner;

export interface Token {
  id: string;
  rfid_uid: string; // Unique RFID card/token identifier
  user_id: string;
  name: string; // Token name (e.g., "Main Card", "Keychain")
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface ScannerAccess {
  id: string;
  user_id: string;
  scanner_id: string;
  granted_by: string; // ID of user who granted access
  created_at: string;
  expires_at: string | null; // Optional access expiration date
}

// Alias for backward compatibility
export type DoorAccess = ScannerAccess;

export interface AccessLog {
  id: string;
  token_id: string;
  scanner_id: string;
  access_granted: boolean;
  timestamp: string;
  rfid_uid: string;
  denial_reason?: string; // Reason for access denial (if applicable)
}

// API response types
export interface AccessCheckResponse {
  scannerId: string;
  tokenId: string;
  accessGranted: boolean;
  timestamp: string;
  userName?: string;
  scannerName?: string;
}

// Form types
export interface CreateUserForm {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}

export interface CreateScannerForm {
  name: string;
  location: string;
  description?: string;
  reader_type: ReaderType;
}

// Alias for backward compatibility
export type CreateDoorForm = CreateScannerForm;

export interface CreateTokenForm {
  rfid_uid: string;
  user_id: string;
  name: string;
}

export interface GrantAccessForm {
  user_id: string;
  scanner_id: string;
  expires_at?: string;
}

// Role hierarchy for permission checks
export const ROLE_HIERARCHY: Record<UserRole, number> = {
    root: 3,
    admin: 2,
    user: 1
};

// Helper to check if a role can manage another role
export function canManageRole(currentRole: UserRole, targetRole: UserRole): boolean {
    return ROLE_HIERARCHY[currentRole] > ROLE_HIERARCHY[targetRole];
}

// Role permissions
export const ROLE_PERMISSIONS = {
    root: {
    // Root has full permissions
        users: {
            create: true,
            read: true,
            update: true,
            delete: true,
            changeRole: true
        },
        scanners: {
            create: true,
            read: true,
            update: true,
            delete: true
        },
        tokens: {
            create: true,
            read: true,
            update: true,
            delete: true
        },
        access: {
            grant: true,
            revoke: true,
            read: true
        },
        logs: {
            read: true,
            export: true
        }
    },
    admin: {
    // Admin can create access accounts but cannot manage other admins
        users: {
            create: true, // Can create new user accounts (not admins)
            read: true,
            update: true, // Can update users with lower role
            delete: false, // Cannot delete users
            changeRole: false // Cannot change roles
        },
        scanners: {
            create: false,
            read: true,
            update: false,
            delete: false
        },
        tokens: {
            create: true, // Can assign tokens to users
            read: true,
            update: true,
            delete: false
        },
        access: {
            grant: true, // Can grant scanner access
            revoke: true, // Can revoke access
            read: true
        },
        logs: {
            read: true,
            export: false
        }
    },
    user: {
    // User has no access to management panel - can only use scanners/readers
        users: {
            create: false,
            read: false,
            update: false,
            delete: false,
            changeRole: false
        },
        scanners: {
            create: false,
            read: false,
            update: false,
            delete: false
        },
        tokens: {
            create: false,
            read: false,
            update: false,
            delete: false
        },
        access: {
            grant: false,
            revoke: false,
            read: false
        },
        logs: {
            read: false,
            export: false
        }
    }
} as const;

// Helper to check permissions
export function hasPermission(role: UserRole, resource: keyof typeof ROLE_PERMISSIONS.root, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) {
        return false;
    }

    const resourcePermissions = permissions[resource] as Record<string, boolean>;
    if (!resourcePermissions) {
        return false;
    }

    return resourcePermissions[action] ?? false;
}
