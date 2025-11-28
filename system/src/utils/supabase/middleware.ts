import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const updateSession = async (request: NextRequest) => {
    let supabaseResponse = NextResponse.next({
        request: {
            headers: request.headers
        }
    });

    const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                supabaseResponse = NextResponse.next({
                    request
                });
                cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
            }
        }
    });

    // Refresh session if expired
    const {
        data: { user }
    } = await supabase.auth.getUser();

    // Protected routes - redirect to login if not authenticated
    // All dashboard routes are under /dashboard prefix
    const isProtectedPath = request.nextUrl.pathname.startsWith('/dashboard');

    if (isProtectedPath && !user) {
        const redirectUrl = new URL('/login', request.url);
        return NextResponse.redirect(redirectUrl);
    }

    // Check if user has 'user' role - they cannot access the management panel
    if (isProtectedPath && user) {
        const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();

        const userRole = userData?.role as UserRole | undefined;

        // Users with 'user' role cannot access the dashboard/management panel
        if (userRole === 'user') {
            const redirectUrl = new URL('/access-denied', request.url);
            return NextResponse.redirect(redirectUrl);
        }
    }

    // Redirect authenticated users away from login page
    // But only if they have admin or root role
    if (request.nextUrl.pathname === '/login' && user) {
        const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();

        const userRole = userData?.role as UserRole | undefined;

        // Only redirect to dashboard if user has admin or root role
        if (userRole === 'admin' || userRole === 'root') {
            const redirectUrl = new URL('/dashboard', request.url);
            return NextResponse.redirect(redirectUrl);
        }
    }

    return supabaseResponse;
};
