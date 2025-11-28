'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { logger } from '@/lib/logger';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, Users, ScanLine, CreditCard, Shield, FileText, LogOut, ChevronUp, KeyRound, Settings, Key, Sun, Moon, Monitor, Check } from 'lucide-react';
import { toast } from 'sonner';

const navigationItems = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard
    },
    {
        title: 'Users',
        url: '/dashboard/users',
        icon: Users
    },
    {
        title: 'Scanners',
        url: '/dashboard/scanners',
        icon: ScanLine
    },
    {
        title: 'Tokens',
        url: '/dashboard/tokens',
        icon: CreditCard
    },
    {
        title: 'Access Control',
        url: '/dashboard/access',
        icon: Shield
    },
    {
        title: 'System Logs',
        url: '/dashboard/logs',
        icon: FileText
    }
];

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const { user, refreshUser } = useAuth();
    const { theme, setTheme } = useTheme();

    const [mounted, setMounted] = useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

    // Prevent hydration mismatch by only rendering client-specific content after mount
    useEffect(() => {
        setMounted(true);
    }, []);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [profileForm, setProfileForm] = useState({
        full_name: ''
    });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isUpdating, setIsUpdating] = useState(false);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error('Failed to sign out', {
                description: error.message
            });
            return;
        }
        toast.success('Signed out successfully');
        router.push('/login');
        router.refresh();
    };

    const openProfileDialog = () => {
        setProfileForm({
            full_name: user?.full_name || ''
        });
        setIsProfileDialogOpen(true);
    };

    const handleUpdateProfile = async () => {
        if (!user) {
            return;
        }
        setIsUpdating(true);

        try {
            const { error } = await supabase.from('users').update({ full_name: profileForm.full_name }).eq('id', user.id);

            if (error) {
                toast.error('Failed to update profile', {
                    description: error.message
                });
                return;
            }

            toast.success('Profile updated successfully');
            await refreshUser();
            setIsProfileDialogOpen(false);
        } catch (error) {
            toast.error('An unexpected error occurred');
            logger.error('Error updating profile:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsUpdating(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordForm.newPassword
            });

            if (error) {
                toast.error('Failed to change password', {
                    description: error.message
                });
                return;
            }

            toast.success('Password changed successfully');
            setIsPasswordDialogOpen(false);
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error) {
            toast.error('An unexpected error occurred');
            logger.error('Error changing password:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    // Get user initials for avatar
    const getInitials = () => {
        if (user?.full_name) {
            const names = user.full_name.split(' ');
            return names
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        if (user?.email) {
            return user.email[0].toUpperCase();
        }
        return 'U';
    };

    // Get display name
    const getDisplayName = () => {
        if (user?.full_name) {
            return user.full_name;
        }
        return user?.email?.split('@')[0] || 'User';
    };

    // Get role badge
    const getRoleBadge = () => {
        if (!user?.role) {
            return null;
        }
        return user.role.charAt(0).toUpperCase() + user.role.slice(1);
    };

    return (
        <>
            <Sidebar>
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <a href="/dashboard">
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                        <KeyRound className="size-4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 leading-none">
                                        <span className="font-semibold">RFID Access</span>
                                        <span className="text-xs text-muted-foreground">Management System</span>
                                    </div>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navigationItems.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={pathname === item.url}>
                                            <a href={item.url}>
                                                <item.icon className="size-4" />
                                                <span>{item.title}</span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            {!mounted ? (
                                <SidebarMenuButton size="lg" className="cursor-default">
                                    <Skeleton className="h-8 w-8 rounded-lg" />
                                    <div className="grid flex-1 gap-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                </SidebarMenuButton>
                            ) : (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                                            <Avatar className="h-8 w-8 rounded-lg">
                                                <AvatarFallback className="rounded-lg">{getInitials()}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-semibold">
                                                    {getDisplayName()}
                                                    {user?.role && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${user.role === 'root' ? 'bg-red-100 text-red-700' : user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{getRoleBadge()}</span>}
                                                </span>
                                                <span className="truncate text-xs text-muted-foreground">{user?.email || ''}</span>
                                            </div>
                                            <ChevronUp className="ml-auto size-4" />
                                        </SidebarMenuButton>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side="top" align="end" sideOffset={4}>
                                        <DropdownMenuItem className="gap-2 p-2 cursor-pointer" onClick={openProfileDialog}>
                                            <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                                                <Settings className="size-4" />
                                            </div>
                                            <div className="font-medium text-muted-foreground">Edit Profile</div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="gap-2 p-2 cursor-pointer" onClick={() => setIsPasswordDialogOpen(true)}>
                                            <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                                                <Key className="size-4" />
                                            </div>
                                            <div className="font-medium text-muted-foreground">Change Password</div>
                                        </DropdownMenuItem>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="gap-2 p-2 cursor-pointer">
                                                <div className="flex size-6 items-center justify-center rounded-md border bg-background">{theme === 'dark' ? <Moon className="size-4" /> : theme === 'light' ? <Sun className="size-4" /> : <Monitor className="size-4" />}</div>
                                                <div className="font-medium text-muted-foreground">Theme</div>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setTheme('light')}>
                                                        <Sun className="size-4" />
                                                        <span>Light</span>
                                                        {theme === 'light' && <Check className="size-4 ml-auto" />}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setTheme('dark')}>
                                                        <Moon className="size-4" />
                                                        <span>Dark</span>
                                                        {theme === 'dark' && <Check className="size-4 ml-auto" />}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setTheme('system')}>
                                                        <Monitor className="size-4" />
                                                        <span>System</span>
                                                        {theme === 'system' && <Check className="size-4 ml-auto" />}
                                                    </DropdownMenuItem>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="gap-2 p-2 cursor-pointer" onClick={handleLogout}>
                                            <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                                                <LogOut className="size-4" />
                                            </div>
                                            <div className="font-medium text-muted-foreground">Sign out</div>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>

            {/* Edit Profile Dialog */}
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>Update your profile information</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={user?.email || ''} disabled />
                            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Full Name</Label>
                            <Input id="full_name" placeholder="Enter your full name" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsProfileDialogOpen(false)}>
              Cancel
                        </Button>
                        <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                            {isUpdating ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change Password Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>Enter a new password for your account</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input id="newPassword" type="password" placeholder="Enter new password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input id="confirmPassword" type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancel
                        </Button>
                        <Button onClick={handleChangePassword} disabled={isUpdating}>
                            {isUpdating ? 'Changing...' : 'Change Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
