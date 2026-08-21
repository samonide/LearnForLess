"use client";

import { redeemTokenAuthenticated } from "@/actions/student/access";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getTokenErrorMessage } from "@/lib/utils";
import { CheckCircle2, KeyRound, Loader2, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function TokenRedeemForm() {
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    courseNames: string[];
  } | null>(null);
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
        setSuccessData({
          courseNames: result.courseNames ?? [],
        });
        router.refresh();
      } else {
        setError(getTokenErrorMessage(result.error));
      }
    });
  }

  function handleCloseSuccess() {
    setSuccessData(null);
  }

  return (
    <>
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
            className={`flex-1 h-8 font-mono text-sm tracking-widest uppercase ${
              error ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
            disabled={isPending}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            disabled={isPending || !token.trim()}
            className="h-8"
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

      {/* ── SUCCESS DIALOG ── */}
      <Dialog open={successData !== null} onOpenChange={handleCloseSuccess}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <PartyPopper className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Congratulations!
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed pt-1">
              You have successfully redeemed your access token and gained access
              to the following course{successData && successData.courseNames.length > 1 ? "s" : ""}:
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {successData?.courseNames.map((name) => (
              <div
                key={name}
                className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-3"
              >
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {name}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button onClick={handleCloseSuccess} className="w-full">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Start Learning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}