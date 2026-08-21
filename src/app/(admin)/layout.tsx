import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  BookOpen,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { logoutStudent } from "@/actions/student/auth";
import { Button } from "@/components/ui/button";
import AdminSidebarNav from "@/components/admin-sidebar-nav";
import AdminMobileSidebar from "@/components/admin-mobile-sidebar";
import Logo from "@/components/logo";
import { getSiteSettings } from "@/lib/site-settings";

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
  const settings = await getSiteSettings();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      {/* Sidebar Navigation — hidden on mobile, visible on desktop */}
      <aside className="hidden md:flex md:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col shrink-0 sticky top-0 h-[100dvh]">
        {/* Brand/Logo Header */}
        <div className="h-16 border-b border-sidebar-border px-6 flex items-center gap-3 bg-sidebar">
          <Logo className="w-7 h-7 text-primary shrink-0" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight leading-none text-sidebar-foreground">
              {settings.site_name}
            </span>
            </div>
        </div>

        {/* Navigation list */}
        <AdminSidebarNav />

        {/* Sidebar Footer User Info */}

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
            {/* Mobile menu trigger */}
            <AdminMobileSidebar displayName={displayName} siteName={settings.site_name} />
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
