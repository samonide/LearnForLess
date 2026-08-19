"use client";

import { registerStudent } from "@/actions/student/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
    <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 md:p-10 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create an Account
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose a username and password. You can redeem your access token for
          courses after signing in.
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
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            className="h-10 bg-background"
            disabled={isPending}
            autoComplete="username"
            autoFocus
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            3-30 characters: letters, numbers, underscore, or dash.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password-input" className="text-xs font-semibold text-foreground">
            Password
          </Label>
          <Input
            id="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="h-10 bg-background"
            disabled={isPending}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-input" className="text-xs font-semibold text-foreground">
            Confirm Password
          </Label>
          <Input
            id="confirm-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            className="h-10 bg-background"
            disabled={isPending}
            autoComplete="new-password"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-10 font-semibold mt-2"
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

      <p className="text-center text-sm text-muted-foreground pt-4 border-t border-border">
        Already have an account?{" "}
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