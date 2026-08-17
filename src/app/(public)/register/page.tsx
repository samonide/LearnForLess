"use client";

import { registerStudent } from "@/actions/student/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUser = username.trim();

    if (!trimmedUser || !password || !confirm) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await registerStudent(trimmedUser, password);

      if (result.success) {
        toast.success("Account created! Please sign in.");
        router.push("/login");
      } else {
        const message =
          result.error === "username_taken"
            ? "That username is already taken."
            : result.error === "username_invalid"
              ? "Username must be 3-30 characters using letters, numbers, underscores, or dashes."
              : result.error === "password_too_short"
                ? "Password must be at least 8 characters."
                : "An unexpected error occurred. Please try again.";
        toast.error(message);
      }
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">
            LearnForLess
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <UserPlus className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Create an Account
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Choose a username and password. You can redeem your access token
              for courses after signing in.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="username-input"
                className="text-sm font-medium text-foreground"
              >
                Username
              </label>
              <Input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="h-10"
                disabled={isPending}
                autoComplete="username"
                autoFocus
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                3-30 characters: letters, numbers, underscore, or dash.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password-input"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <Input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-10"
                disabled={isPending}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirm-input"
                className="text-sm font-medium text-foreground"
              >
                Confirm Password
              </label>
              <Input
                id="confirm-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className="h-10"
                disabled={isPending}
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isPending || !username.trim() || !password || !confirm}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LearnForLess. All rights reserved.
      </footer>
    </div>
  );
}