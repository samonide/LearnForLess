"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, ShieldAlert, Loader2 } from "lucide-react";

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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">LearnForLess</span>
        </div>
      </header>

      {/* Login Box */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-xl space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Admin Portal</h1>
            <p className="text-xs text-slate-400">
              Sign in to manage courses, tokens, and portal configurations
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="email-input" className="text-xs font-semibold text-slate-300">
                Email Address
              </Label>
              <Input
                id="email-input"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 focus-visible:ring-primary focus-visible:border-primary text-slate-100 h-10"
                disabled={isPending}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password-input" className="text-xs font-semibold text-slate-300">
                Password
              </Label>
              <Input
                id="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 focus-visible:ring-primary focus-visible:border-primary text-slate-100 h-10"
                disabled={isPending}
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-bold bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
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
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} LearnForLess. All rights reserved.
      </footer>
    </div>
  );
}
