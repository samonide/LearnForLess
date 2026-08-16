import { BookOpen, KeyRound } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">LearnForLess</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Welcome to LearnForLess</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Please choose how you want to log in
            </p>
          </div>

          <div className="space-y-4">
            {/* Student access */}
            <Link
              href="/access"
              className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Student Portal
                </h2>
                <p className="text-xs text-muted-foreground">
                  Enter your access token to view courses
                </p>
              </div>
            </Link>

            {/* Admin access intentionally hidden from public student flow */}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LearnForLess. All rights reserved.
      </footer>
    </div>
  );
}
