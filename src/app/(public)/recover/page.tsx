"use client";

import { resetPasswordWithRecoveryToken } from "@/actions/student/recovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRecoveryErrorMessage } from "@/lib/utils";
import { BookOpen, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export default function RecoverPage() {
  const [username, setUsername] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }

    if (!recoveryToken.trim()) {
      setError("Please enter your recovery token.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await resetPasswordWithRecoveryToken(
        username.trim(),
        recoveryToken.trim(),
        newPassword
      );

      if (result.success) {
        setSuccess(true);
        toast.success("Password reset successfully! You can now sign in.");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        const message = getRecoveryErrorMessage(result.error);
        setError(message);
        toast.error(message);
      }
    });
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">LearnForLess</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Password Reset Successful</h1>
            <p className="text-muted-foreground text-sm">
              Your password has been reset. Redirecting you to sign in...
            </p>
          </div>
        </main>
        <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} LearnForLess. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">LearnForLess</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Reset Your Password
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Enter the recovery token provided by your administrator along with
              your new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username-input" className="text-sm font-medium text-foreground">
                Username
              </label>
              <Input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                placeholder="Enter your username"
                className={`h-10 ${error ? "border-destructive" : ""}`}
                disabled={isPending}
                autoComplete="username"
                autoFocus
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="token-input" className="text-sm font-medium text-foreground">
                Recovery Token
              </label>
              <Input
                id="token-input"
                type="text"
                value={recoveryToken}
                onChange={(e) => { setRecoveryToken(e.target.value.toUpperCase()); setError(null); }}
                placeholder="Enter your recovery token"
                className={`h-10 font-mono tracking-wider uppercase ${error ? "border-destructive" : ""}`}
                disabled={isPending}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password-input" className="text-sm font-medium text-foreground">
                New Password
              </label>
              <Input
                id="password-input"
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                placeholder="At least 8 characters"
                className={`h-10 ${error ? "border-destructive" : ""}`}
                disabled={isPending}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password-input" className="text-sm font-medium text-foreground">
                Confirm New Password
              </label>
              <Input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                placeholder="Re-enter your new password"
                className={`h-10 ${error ? "border-destructive" : ""}`}
                disabled={isPending}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isPending || !username.trim() || !recoveryToken.trim() || !newPassword || !confirmPassword}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LearnForLess. All rights reserved.
      </footer>
    </div>
  );
}