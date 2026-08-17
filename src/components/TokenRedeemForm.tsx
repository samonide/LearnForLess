"use client";

import { redeemTokenAuthenticated } from "@/actions/student/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTokenErrorMessage } from "@/lib/utils";
import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function TokenRedeemForm() {
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
      const result = await redeemTokenAuthenticated(trimmed);

      if (result.success) {
        setToken("");
        setError(null);
        router.refresh();
      } else {
        setError(getTokenErrorMessage(result.error));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="text"
          value={token}
          onChange={(e) => {
            setToken(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`flex-1 h-10 font-mono text-sm tracking-widest uppercase ${
            error ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
          disabled={isPending}
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="submit"
          disabled={isPending || !token.trim()}
          className="h-10"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <KeyRound className="w-4 h-4 mr-1.5" />
              Redeem
            </>
          )}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}