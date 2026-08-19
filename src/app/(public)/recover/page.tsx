"use client";

import { resetPasswordWithRecoveryToken } from "@/actions/student/recovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRecoveryErrorMessage } from "@/lib/utils";
import { Loader2 } from "lucide-react";
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
      <div className="max-w-md w-full text-center space-y-4 px-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Password Reset Successful
        </h1>
        <p className="text-sm text-muted-foreground">
          Your password has been reset. Redirecting you to sign in...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 md:p-10 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Reset Your Password
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Enter the recovery token provided by your administrator along with
          your new password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="username-input" className="text-xs font-semibold text-foreground">
            Username
          </Label>
          <Input
            id="username-input"
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(null); }}
            placeholder="Enter your username"
            className={`h-10 bg-background ${error ? "border-destructive" : ""}`}
            disabled={isPending}
            autoComplete="username"
            autoFocus
            spellCheck={false}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="token-input" className="text-xs font-semibold text-foreground">
            Recovery Token
          </Label>
          <Input
            id="token-input"
            type="text"
            value={recoveryToken}
            onChange={(e) => { setRecoveryToken(e.target.value.toUpperCase()); setError(null); }}
            placeholder="Enter your recovery token"
            className={`h-10 bg-background font-mono tracking-wider uppercase ${error ? "border-destructive" : ""}`}
            disabled={isPending}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password-input" className="text-xs font-semibold text-foreground">
            New Password
          </Label>
          <Input
            id="password-input"
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
            placeholder="At least 8 characters"
            className={`h-10 bg-background ${error ? "border-destructive" : ""}`}
            disabled={isPending}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password-input" className="text-xs font-semibold text-foreground">
            Confirm New Password
          </Label>
          <Input
            id="confirm-password-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
            placeholder="Re-enter your new password"
            className={`h-10 bg-background ${error ? "border-destructive" : ""}`}
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
          className="w-full h-10 font-semibold mt-2"
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

      <p className="text-center text-sm text-muted-foreground pt-4 border-t border-border">
        Remember your password?{" "}
        <Link
          href="/login"
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}