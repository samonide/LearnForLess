"use client";

import { redeemToken } from "@/actions/student/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTokenErrorMessage } from "@/lib/utils";
import { BookOpen, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export default function AccessPage() {
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please enter your access token.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await redeemToken(trimmed);

      if (result.success) {
        toast.success("Access granted! Loading your courses...");
        router.push("/dashboard");
        router.refresh();
      } else {
        const message = getTokenErrorMessage(result.error);
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">LearnForLess</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Icon + Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Enter Your Access Token
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Enter the access token provided by your instructor to unlock your courses.
            </p>
          </div>

          {/* Token form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="token-input"
                className="text-sm font-medium text-foreground"
              >
                Access Token
              </label>
              <Input
                id="token-input"
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className={`h-12 text-center font-mono text-base tracking-widest uppercase ${
                  error ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                disabled={isPending}
                autoComplete="off"
                autoFocus
                spellCheck={false}
              />
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isPending || !token.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          {/* Trust indicators */}
          <div className="mt-8 pt-6 border-t border-border flex items-start gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p>
              Your token is verified securely on our server. We never store your
              raw token.
            </p>
          </div>

          {/* Admin link intentionally hidden from student-facing access flow */}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LearnForLess. All rights reserved.
      </footer>
    </div>
  );
}
