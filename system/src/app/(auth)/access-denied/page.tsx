'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function AccessDeniedPage() {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success('Logged out successfully');
        router.push('/login');
        router.refresh();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex items-center justify-center mb-4">
                        <div className="p-3 rounded-full bg-destructive/10">
                            <ShieldX className="h-8 w-8 text-destructive" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl text-center">Access Denied</CardTitle>
                    <CardDescription className="text-center">Your account does not have access to the management panel</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center text-muted-foreground">
                    <p>
            Your account has the <strong>user</strong> role, which only allows you to use doors and RFID readers that you have been granted access to.
                    </p>
                    <p>If you need access to the management panel, please contact your system administrator.</p>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" className="w-full" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
            Sign Out
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
