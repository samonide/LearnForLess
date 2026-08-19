"use client";

import { generateAccessToken } from "@/actions/admin/tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Check, Copy, Key, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface NewTokenFormProps {
  courses: {
    id: string;
    title: string;
    status: string;
  }[];
}

export default function NewTokenForm({ courses }: NewTokenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");

  // Result display state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCourseToggle(courseId: string) {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  }

  function handleSelectAll() {
    if (selectedCourses.length === courses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(courses.map((c) => c.id));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a student account name.");
      return;
    }
    if (selectedCourses.length === 0) {
      toast.error("Please select at least one course.");
      return;
    }

    startTransition(async () => {
      const res = await generateAccessToken({
        name,
        description,
        course_ids: selectedCourses,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setGeneratedToken(res.data.rawToken);
      toast.success("Token generated successfully!");
    });
  }

  async function handleCopy() {
    if (!generatedToken) return;
    try {
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      toast.success("Token copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please select the text and copy manually.");
    }
  }

  function handleCloseModal() {
    setGeneratedToken(null);
    router.push("/admin/tokens");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="token-name">Token Name *</Label>
          <Input
            id="token-name"
            type="text"
            placeholder="e.g. John Carter"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="token-desc">Validation / Notes</Label>
          <Textarea
            id="token-desc"
            placeholder="e.g. Foundation batch student, weekend access only"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
          />
        </div>

        {/* Course checklists */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <Label className="text-sm font-semibold">Assign Courses *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-8 text-xs text-primary"
            >
              {selectedCourses.length === courses.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
            {courses.map((course) => {
              const isChecked = selectedCourses.includes(course.id);
              return (
                <div
                  key={course.id}
                  onClick={() => handleCourseToggle(course.id)}
                  className={`border rounded-lg p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent dark:hover:bg-accent transition-colors ${
                    isChecked
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleCourseToggle(course.id)}
                      disabled={isPending}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm font-medium text-foreground truncate">
                      {course.title}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] capitalize shrink-0 font-mono">
                    {course.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Limits */}
        <div className="grid grid-cols-1 gap-4 border-t border-border pt-5">
          {/* Expiration */}
          <div className="space-y-1.5 text-left">
            <Label htmlFor="token-expiry">Expiration Date</Label>
            <Input
              id="token-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={isPending}
              min={new Date().toISOString().split("T")[0]}
            />
            <span className="block text-[10px] text-muted-foreground">
              Optional date. This student token will deactivate automatically after this day.
            </span>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="border-t border-border pt-5 flex items-center justify-end gap-3">
          <Link href="/admin/tokens">
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isPending || !name.trim()}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Token"
            )}
          </Button>
        </div>
      </form>

      {/* ── ONE TIME TOKEN RESULT MODAL ───────────────────────── */}
      <Dialog open={generatedToken !== null} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-muted border border-border rounded-full flex items-center justify-center mb-2">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Access Token Generated
            </DialogTitle>
            <DialogDescription className="text-center font-medium text-destructive dark:text-red-400 flex items-center gap-1.5 justify-center mt-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              This token will only be shown ONCE. Copy it now.
            </DialogDescription>
          </DialogHeader>

          {/* Token Box */}
          <div className="py-6 space-y-4">
            <div className="bg-muted/30 border border-border p-4 rounded-lg text-center select-all font-mono text-lg font-semibold tracking-wider text-primary break-all">
              {generatedToken}
            </div>

            <Button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 h-11"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied Token</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Token Code</span>
                </>
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={handleCloseModal} className="w-full" variant="outline">
              I have copied the token. Close.
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
