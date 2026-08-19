"use client";

import { updateToken, updateTokenCourses } from "@/actions/admin/tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface EditTokenFormProps {
  token: {
    id: string;
    name: string;
    description: string | null;
    expires_at: string | null;
    selectedCourseIds: string[];
  };
  courses: {
    id: string;
    title: string;
    status: string;
  }[];
}

export default function EditTokenForm({ token, courses }: EditTokenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(token.name);
  const [description, setDescription] = useState(token.description ?? "");
  const [expiresAt, setExpiresAt] = useState(token.expires_at ? token.expires_at.slice(0, 10) : "");
  const [selectedCourses, setSelectedCourses] = useState<string[]>(token.selectedCourseIds);

  function handleCourseToggle(courseId: string) {
    setSelectedCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  }

  function handleSelectAll() {
    if (selectedCourses.length === courses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(courses.map((course) => course.id));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Student account name is required.");
      return;
    }

    if (selectedCourses.length === 0) {
      toast.error("Select at least one course.");
      return;
    }

    startTransition(async () => {
      const tokenUpdate = await updateToken(token.id, {
        name,
        description,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      if (!tokenUpdate.success) {
        toast.error(tokenUpdate.error);
        return;
      }

      const coursesUpdate = await updateTokenCourses(token.id, selectedCourses);
      if (!coursesUpdate.success) {
        toast.error(coursesUpdate.error);
        return;
      }

      toast.success("Student token account updated.");
      router.push("/admin/tokens");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="student-name">Student Account Name *</Label>
        <Input
          id="student-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. John Carter"
          disabled={isPending}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="student-notes">Validation / Notes</Label>
        <Textarea
          id="student-notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Web Fundamentals batch student"
          rows={3}
          disabled={isPending}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <Label className="text-sm font-semibold">Assigned Courses *</Label>
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
            const checked = selectedCourses.includes(course.id);
            return (
              <div
                key={course.id}
                onClick={() => handleCourseToggle(course.id)}
                className={`border rounded-lg p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent dark:hover:bg-accent transition-colors ${
                  checked ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => handleCourseToggle(course.id)}
                    disabled={isPending}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm font-medium text-foreground truncate">{course.title}</span>
                </div>
                <Badge variant="outline" className="text-[9px] capitalize shrink-0 font-mono">
                  {course.status}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5 text-left border-t border-border pt-5">
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

      <div className="border-t border-border pt-5 flex items-center justify-end gap-3">
        <Link href="/admin/tokens">
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={isPending || !name.trim()}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
