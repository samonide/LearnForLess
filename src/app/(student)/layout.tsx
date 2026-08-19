import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, LogOut, User as UserIcon } from "lucide-react";
import { logoutStudent } from "@/actions/student/auth";
import { Button } from "@/components/ui/button";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch student profile
  const { data: profile } = (await supabase
    .from("profiles")
    .select("display_name, email, username")
    .eq("id", user.id)
    .single()) as any;

  const displayName = profile?.display_name || profile?.username || "Student";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg tracking-tight text-foreground">
                LearnForLess
              </span>
            </Link>
            <nav className="hidden md:flex gap-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Dashboard
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <div className="w-8 h-8 rounded-xl bg-muted ring-1 ring-foreground/5 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground hidden sm:inline">
                {displayName}
              </span>
            </div>
            
            <form action={logoutStudent}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
