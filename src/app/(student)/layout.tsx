import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";
import { logoutStudent } from "@/actions/student/auth";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { getSiteSettings } from "@/lib/site-settings";

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

  const settings = await getSiteSettings();

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
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="w-full px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <Logo className="w-6 h-6 text-primary shrink-0" />
            <span className="font-semibold text-base tracking-tight text-foreground">
              {settings.site_name}
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground text-sm hidden sm:inline">
                {displayName}
              </span>
            </div>

            <form action={logoutStudent}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
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
