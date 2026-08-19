"use client";

import { generateAccessToken } from "@/actions/admin/tokens";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Course } from "@/types";
import { AlertTriangle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface NewTokenFormProps {
  courses: Course[];
}

export default function NewTokenForm({ courses }: NewTokenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [hasMaxUses, setHasMaxUses] = useState(false);

  // Modal state for one-time display
  const [showModal, setShowModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<{
    raw: string;
    id: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleCourse(courseId: string) {
    const updated = new Set(selectedCourses);
    if (updated.has(courseId)) {
      updated.delete(courseId);
    } else {
      updated.add(courseId);
    }
    setSelectedCourses(updated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a token name.");
      return;
    }

    if (selectedCourses.size === 0) {
      toast.error("Please select at least one course.");
      return;
    }

    startTransition(async () => {
      const res = await generateAccessToken({
        name: name.trim(),
        description: description.trim() || undefined,
        course_ids: Array.from(selectedCourses),
        expires_at: hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        max_uses: hasMaxUses && maxUses ? parseInt(maxUses, 10) : undefined,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setGeneratedToken({
        raw: res.data.rawToken,
        id: res.data.tokenId,
      });
      setShowModal(true);

      setName("");
      setDescription("");
      setSelectedCourses(new Set());
      setExpiresAt("");
      setMaxUses("");
      setHasExpiry(false);
      setHasMaxUses(false);
    });
  }

  function handleCopyToken() {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken.raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setGeneratedToken(null);
    setCopied(false);
    router.refresh();
  }

  return (
    <>
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Name */}
        <div className="space-y-1.5">
          <Label htmlFor="token-name">Token Name *</Label>
          <Input
            id="token-name"
            type="text"
            placeholder="e.g., Fall 2025 Cohort A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            required
          />
          <span className="block text-[10px] text-muted-foreground">
            A memorable identifier for this batch of tokens.
          </span>
        </div>

        {/* Token Description */}
        <div className="space-y-1.5">
          <Label htmlFor="token-description">Description (Optional)</Label>
          <Input
            id="token-description"
            type="text"
            placeholder="e.g., Group access for online cohort"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
          />
        </div>

        {/* Assign Courses */}
        <div className="space-y-2">
          <Label>Assign Courses *</Label>
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20 max-h-48 overflow-y-auto">
            {courses.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No courses available. Create a course first.
              </div>
            ) : (
              courses.map((course) => (
                <div key={course.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`course-${course.id}`}
                    checked={selectedCourses.has(course.id)}
                    onCheckedChange={() => toggleCourse(course.id)}
                    disabled={isPending}
                  />
                  <Label
                    htmlFor={`course-${course.id}`}
                    className="flex-1 cursor-pointer font-normal text-foreground"
                  >
                    {course.title}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({course.status})
                    </span>
                  </Label>
                </div>
              ))
            )}
          </div>
          <span className="block text-[10px] text-muted-foreground">
            Select which courses this token will grant access to.
          </span>
        </div>

        {/* Expiration */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Checkbox
              id="has-expiry"
              checked={hasExpiry}
              onCheckedChange={(checked) => setHasExpiry(checked as boolean)}
              disabled={isPending}
            />
            <Label htmlFor="has-expiry" className="font-normal text-foreground cursor-pointer">
              Set Expiration Date
            </Label>
          </div>
          {hasExpiry && (
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={isPending}
              className="w-full"
            />
          )}
        </div>

        {/* Max Uses */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Checkbox
              id="has-max-uses"
              checked={hasMaxUses}
              onCheckedChange={(checked) => setHasMaxUses(checked as boolean)}
              disabled={isPending}
            />
            <Label htmlFor="has-max-uses" className="font-normal text-foreground cursor-pointer">
              Limit Maximum Redemptions
            </Label>
          </div>
          {hasMaxUses && (
            <Input
              type="number"
              min="1"
              placeholder="e.g., 50"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              disabled={isPending}
              className="w-full"
            />
          )}
        </div>

        {/* Submit Button */}
        <div className="border-t border-border pt-5">
          <Button type="submit" disabled={isPending} className="w-full h-11">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Token...
              </>
            ) : (
              "Generate Token"
            )}
          </Button>
        </div>
      </form>

      {/* One-Time Token Display Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500" />
              Token Generated Successfully
            </DialogTitle>
            <DialogDescription>
              Your access token has been created. Copy it now — you won't be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Warning */}
            <div className="border border-destructive/50 bg-destructive/5 p-4 rounded-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-destructive">Save This Token Now</p>
                <p className="text-muted-foreground">
                  This is the only time you'll see the raw token value. Once you close this dialog, the token hash is stored and the raw value is destroyed.
                </p>
              </div>
            </div>

            {/* Token Display */}
            <div className="bg-muted p-4 rounded-lg border border-border font-mono text-sm break-all">
              {generatedToken?.raw}
            </div>

            {/* Copy Button */}
            <Button
              onClick={handleCopyToken}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copied to Clipboard
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Token
                </>
              )}
            </Button>

            {/* Info Box */}
            <div className="bg-card p-4 rounded-lg border border-border text-sm space-y-2">
              <p className="font-semibold text-foreground">Next Steps:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Share this token with students via email or portal</li>
                <li>Students redeeming it will gain access to the assigned courses</li>
                <li>They'll gain instant access to the assigned courses</li>
              </ul>
            </div>

            {/* Close Button */}
            <Button onClick={handleCloseModal} className="w-full">
              Done, Close Dialog
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
