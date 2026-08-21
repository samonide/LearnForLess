import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function RootNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <FileQuestion className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}