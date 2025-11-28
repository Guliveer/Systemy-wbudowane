'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

// Lazy initialization of admin client to ensure environment variables are available
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Support both old and new naming conventions for the secret key
    const supabaseSecretKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
        throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_API_KEY)');
    }

    return createClient(supabaseUrl, supabaseSecretKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

interface CreateUserParams {
  email: string;
  password: string;
  full_name: string;
  role: 'user' | 'admin';
}

interface CreateUserResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
  };
}

export async function createUser(params: CreateUserParams): Promise<CreateUserResult> {
    // Get admin client first to fail fast if env vars are missing
    let supabaseAdmin;
    try {
        supabaseAdmin = getSupabaseAdmin();
    } catch (envError) {
        console.error('Environment configuration error:', envError);
        return { success: false, error: 'Server configuration error. Please contact administrator.' };
    }

    try {
    // Verify the requesting user is authenticated and has permission
        const supabase = await createServerClient();
        const {
            data: { user: currentUser },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        // Get current user's role from database
        const { data: currentUserData, error: userError } = await supabase.from('users').select('role').eq('id', currentUser.id).single();

        if (userError || !currentUserData) {
            return { success: false, error: 'User not found' };
        }

        const currentUserRole = currentUserData.role;

        // Only root and admin can create users
        if (currentUserRole !== 'root' && currentUserRole !== 'admin') {
            return { success: false, error: 'Insufficient permissions' };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(params.email)) {
            return { success: false, error: 'Invalid email format' };
        }

        // Validate password length
        if (params.password.length < 6) {
            return { success: false, error: 'Password must be at least 6 characters' };
        }

        // Determine the role to assign
        let assignedRole: 'user' | 'admin' = 'user';
        if (currentUserRole === 'root' && params.role) {
            // Root can assign user or admin role (not root)
            assignedRole = params.role;
        }
        // Admin can only create users with 'user' role

        // Create user with admin API (doesn't log in the new user)
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: params.email,
            password: params.password,
            email_confirm: true,
            user_metadata: {
                full_name: params.full_name
            }
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return { success: false, error: createError.message };
        }

        if (!authData.user) {
            return { success: false, error: 'Failed to create user' };
        }

        // Update user profile in users table
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                full_name: params.full_name,
                role: assignedRole
            })
            .eq('id', authData.user.id);

        if (updateError) {
            console.error('Error updating user profile:', updateError);
            // User was created but profile update failed - still return success
        }

        return {
            success: true,
            user: {
                id: authData.user.id,
                email: authData.user.email!
            }
        };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

interface DeleteUserResult {
  success: boolean;
  error?: string;
}

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
    // Get admin client first to fail fast if env vars are missing
    let supabaseAdmin;
    try {
        supabaseAdmin = getSupabaseAdmin();
    } catch (envError) {
        console.error('Environment configuration error:', envError);
        return { success: false, error: 'Server configuration error. Please contact administrator.' };
    }

    try {
        const supabase = await createServerClient();
        const {
            data: { user: currentUser },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        // Get current user's role from database
        const { data: currentUserData, error: userError } = await supabase.from('users').select('role').eq('id', currentUser.id).single();

        if (userError || !currentUserData) {
            return { success: false, error: 'User not found' };
        }

        // Only root can delete users
        if (currentUserData.role !== 'root') {
            return { success: false, error: 'Insufficient permissions' };
        }

        // Cannot delete yourself
        if (userId === currentUser.id) {
            return { success: false, error: 'Cannot delete your own account' };
        }

        // Delete user with admin API
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('Error deleting user:', deleteError);
            return { success: false, error: deleteError.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<ResetPasswordResult> {
    // Get admin client first to fail fast if env vars are missing
    let supabaseAdmin;
    try {
        supabaseAdmin = getSupabaseAdmin();
    } catch (envError) {
        console.error('Environment configuration error:', envError);
        return { success: false, error: 'Server configuration error. Please contact administrator.' };
    }

    try {
        const supabase = await createServerClient();
        const {
            data: { user: currentUser },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return { success: false, error: 'Unauthorized' };
        }

        // Get current user's role from database
        const { data: currentUserData, error: userError } = await supabase.from('users').select('role').eq('id', currentUser.id).single();

        if (userError || !currentUserData) {
            return { success: false, error: 'User not found' };
        }

        // Validate password length
        if (newPassword.length < 6) {
            return { success: false, error: 'Password must be at least 6 characters' };
        }

        // Get target user's role
        const { data: targetUser, error: targetError } = await supabase.from('users').select('role').eq('id', userId).single();

        if (targetError || !targetUser) {
            return { success: false, error: 'Target user not found' };
        }

        // Check permissions
        const currentRole = currentUserData.role;
        const targetRole = targetUser.role;

        // Root can reset anyone's password except other roots
        // Admin can reset user passwords only
        const canReset = (currentRole === 'root' && targetRole !== 'root') || (currentRole === 'admin' && targetRole === 'user');

        if (!canReset) {
            return { success: false, error: 'Insufficient permissions' };
        }

        // Reset password with admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (updateError) {
            console.error('Error resetting password:', updateError);
            return { success: false, error: updateError.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'Internal server error' };
    }
}
