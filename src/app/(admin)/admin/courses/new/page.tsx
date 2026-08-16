"use client";

import { createCourse } from "@/actions/admin/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateSlug } from "@/lib/utils";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export default function NewCoursePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");

  // Auto generate slug when title changes, unless manually modified
  const [manualSlug, setManualSlug] = useState(false);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!manualSlug) {
      setSlug(generateSlug(val));
    }
  }

  function handleSlugChange(val: string) {
    setSlug(generateSlug(val));
    setManualSlug(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a course title.");
      return;
    }

    startTransition(async () => {
      const res = await createCourse({
        title,
        slug,
        description,
        thumbnail_url: thumbnailUrl || undefined,
        status,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      toast.success("Course created successfully!");
      router.push(`/admin/courses/${res.data.id}/builder`);
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Courses
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Create New Course
        </h1>
        <p className="text-muted-foreground text-sm">
          Define the course title, clean slug address, short description, and publishing state.
        </p>
      </div>

      {/* Form Card */}
      <div className="border border-border bg-card p-6 rounded-xl shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="course-title">Course Title *</Label>
            <Input
              id="course-title"
              type="text"
              placeholder="e.g. Next.js Masterclass"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="course-slug">URL Slug (Auto-generated) *</Label>
            <Input
              id="course-slug"
              type="text"
              placeholder="nextjs-masterclass"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={isPending}
              required
            />
            <span className="block text-[10px] text-muted-foreground">
              Unique URL path identifier. Only letters, numbers, and dashes.
            </span>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="course-description">Description</Label>
            <Textarea
              id="course-description"
              placeholder="Describe what students will learn in this course..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Thumbnail URL */}
          <div className="space-y-1.5">
            <Label htmlFor="course-thumbnail">Thumbnail URL</Label>
            <Input
              id="course-thumbnail"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              disabled={isPending}
            />
            <span className="block text-[10px] text-muted-foreground">
              Optional path to course card banner illustration.
            </span>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="course-status">Publishing Status</Label>
            <Select
              value={status}
              onValueChange={(val: any) => setStatus(val)}
              disabled={isPending}
            >
              <SelectTrigger id="course-status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (Hidden from students)</SelectItem>
                <SelectItem value="published">Published (Visible to students)</SelectItem>
                <SelectItem value="archived">Archived (Deactivated / readonly)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Form Actions */}
          <div className="border-t border-border pt-5 flex items-center justify-end gap-3">
            <Link href="/admin/courses">
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Continue to Builder"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
