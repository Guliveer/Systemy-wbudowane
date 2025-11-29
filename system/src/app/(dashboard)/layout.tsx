import { redirect } from 'next/navigation';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { AuthProvider } from '@/lib/auth-context';
import { createClient } from '@/utils/supabase/server';
import type { UserRole } from '@/types/database';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();

    const {
        data: { user }
    } = await supabase.auth.getUser();

    // Redirect to login if not authenticated
    if (!user) {
        redirect('/login');
    }

    // Check user role - only admin and root can access dashboard
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();

    const userRole = userData?.role as UserRole | undefined;

    // Users with 'user' role cannot access the dashboard
    if (userRole === 'user') {
        redirect('/access-denied');
    }

    return (
        <AuthProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="sticky top-0 z-10 flex h-10 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 md:hidden">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                    </header>
                    <main className="flex-1 p-6">{children}</main>
                </SidebarInset>
            </SidebarProvider>
        </AuthProvider>
    );
}
