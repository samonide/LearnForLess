import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  Key,
  Users,
  Settings,
  LogOut,
  Bell,
  Search,
  User as UserIcon,
  BookMarked,
  ShieldCheck,
} from "lucide-react";
import { logoutStudent } from "@/actions/student/auth";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  // Double check admin role on server side
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single()) as any;

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const displayName = profile.display_name || user.email || "Admin";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shrink-0">
        {/* Brand/Logo Header */}
        <div className="h-16 border-b border-sidebar-border px-6 flex items-center gap-3 bg-sidebar">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight leading-none text-sidebar-foreground">
              LearnForLess
            </span>
            <span className="text-[10px] text-sidebar-foreground/50 font-semibold mt-0.5 tracking-wider uppercase">
              CMS
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sidebar-foreground/80"
          >
            <LayoutDashboard className="w-4 h-4 text-sidebar-foreground/60" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/admin/courses"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sidebar-foreground/80"
          >
            <BookMarked className="w-4 h-4 text-sidebar-foreground/60" />
            <span>Courses</span>
          </Link>
          <Link
            href="/admin/tokens"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sidebar-foreground/80"
          >
            <Key className="w-4 h-4 text-sidebar-foreground/60" />
            <span>Access Tokens</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sidebar-foreground/80"
          >
            <Users className="w-4 h-4 text-sidebar-foreground/60" />
            <span>User Directory</span>
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sidebar-foreground/80"
          >
            <Settings className="w-4 h-4 text-sidebar-foreground/60" />
            <span>Settings</span>
          </Link>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-sidebar-border bg-sidebar flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden text-xs">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 border border-sidebar-border">
              <ShieldCheck className="w-4 h-4 text-sidebar-primary" />
            </div>
            <div className="flex flex-col truncate">
              <span className="font-semibold text-sidebar-foreground truncate">
                {displayName}
              </span>
              <span className="text-[10px] text-sidebar-foreground/50">Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        {/* Top Header Bar */}
        <header className="h-16 bg-card/95 backdrop-blur border-b border-border px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Logout button */}
            <form action={logoutStudent}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="flex items-center gap-2 h-9 border-border bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Admin page container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
