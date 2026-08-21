"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Logo from "@/components/logo";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.error("Please enter email and password.");
      return;
    }

    startTransition(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Check if user is admin
      const { data: profile, error: profileError } = (await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()) as any;

      if (profileError || !profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        toast.error("Access denied: You are not authorized as an administrator.");
        return;
      }

      toast.success("Login successful!");
      router.push("/admin/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo className="w-7 h-7 text-primary" />
          <span className="font-semibold text-lg tracking-tight text-foreground">
            LearnForLess
          </span>
        </div>
      </header>

      {/* Login Box */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 sm:p-8 md:p-10 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Admin Portal
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to manage courses, tokens, and portal configurations
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="email-input" className="text-xs font-semibold text-foreground">
                Email Address
              </Label>
              <Input
                id="email-input"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 bg-background"
                disabled={isPending}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password-input" className="text-xs font-semibold text-foreground">
                Password
              </Label>
              <Input
                id="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 bg-background"
                disabled={isPending}
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-semibold mt-2"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LearnForLess. All rights reserved.
      </footer>
    </div>
  );
}