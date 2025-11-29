'use client';

import { logger } from '@/lib/logger';
import type { User, UserRole } from '@/types/database';
import { createClient } from '@/utils/supabase/client';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    refreshUser: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    const fetchUser = async () => {
        try {
            const {
                data: { user: authUser },
                error: authError
            } = await supabase.auth.getUser();

            if (authError) {
                logger.error('Auth error:', authError);
                setUser(null);
                setIsLoading(false);
                return;
            }

            if (authUser) {
                logger.log('Auth user found:', authUser.id, authUser.email);

                // Try to get user from users table
                const { data: userData, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();

                logger.log('User data query result:', { userData, error });

                if (error) {
                    logger.error('Error fetching user data:', error);
                    // If user doesn't exist in users table or RLS error, create a basic user object from auth data
                    // This is a fallback - the user should fix RLS policies in Supabase
                    setUser({
                        id: authUser.id,
                        email: authUser.email || '',
                        role: 'user' as const,
                        full_name: authUser.user_metadata?.full_name || null,
                        created_at: authUser.created_at || new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_active: true
                    });
                } else {
                    logger.log('Setting user from database:', userData);
                    setUser(userData as User);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            logger.error('Error in fetchUser:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                await fetchUser();
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return <AuthContext.Provider value={{ user, isLoading, refreshUser: fetchUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Helper to check if current user can manage target user
export function canManageUser(currentUserRole: UserRole, targetUserRole: UserRole): boolean {
    const hierarchy: Record<UserRole, number> = {
        root: 3,
        admin: 2,
        user: 1
    };
    return hierarchy[currentUserRole] > hierarchy[targetUserRole];
}
