"use client";

import { loginStudent } from "@/actions/student/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export default function StudentLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      toast.error("Please enter username and password.");
      return;
    }

    startTransition(async () => {
      const result = await loginStudent(trimmedUser, trimmedPass);

      if (result.success) {
        toast.success("Logged in successfully!");
        router.push("/dashboard");
        router.refresh();
      } else {
        const message =
          result.error === "invalid_credentials"
            ? "Invalid username or password."
            : "An unexpected error occurred. Please try again.";
        toast.error(message);
      }
    });
  }

  return (
    <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 md:p-10 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Student Login
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sign in with your username and password.
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
            placeholder="Enter your username"
            className="h-10 bg-background"
            disabled={isPending}
            autoComplete="username"
            autoFocus
            spellCheck={false}
          />
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
            placeholder="Enter your password"
            className="h-10 bg-background"
            disabled={isPending}
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-10 font-semibold mt-2"
          disabled={isPending || !username.trim() || !password.trim()}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-2 pt-4 border-t border-border text-sm">
        <p className="text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary font-medium hover:underline"
          >
            Register here
          </Link>
        </p>
        <Link
          href="/recover"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}