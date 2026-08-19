"use client";

import { createCourse, uploadCourseThumbnail } from "@/actions/admin/courses";
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
import { ArrowLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";

export default function NewCoursePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

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

  function handleThumbnailChange(file: File | null) {
    // Revoke previous object URL to avoid leaks
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(file);
    setThumbnailPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleThumbnailUpload(courseId: string) {
    if (!thumbnailFile) return;
    const res = await uploadCourseThumbnail(courseId, thumbnailFile);
    if (!res.success) {
      toast.error(`Course created, but thumbnail upload failed: ${res.error}`);
      router.push(`/admin/courses/${courseId}/builder`);
      return;
    }
    toast.success("Course created with cover image uploaded successfully!");
    router.push(`/admin/courses/${courseId}/builder`);
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
        status,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      await handleThumbnailUpload(res.data.id);
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New Course
        </h1>
        <p className="text-muted-foreground text-sm">
          Define the title, slug, description, and publishing state.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8">
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

          {/* Cover Image Upload */}
          <div className="space-y-1.5">
            <Label htmlFor="course-cover-image">Cover Image</Label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="course-cover-image"
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background hover:bg-accent cursor-pointer text-sm font-medium text-muted-foreground disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                {thumbnailFile ? "Change Image" : "Upload Image"}
                <input
                  id="course-cover-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isPending}
                  onChange={(e) => {
                    handleThumbnailChange(e.target.files?.[0] ?? null);
                    // Reset so the same file can be re-selected
                    e.target.value = "";
                  }}
                />
              </label>
              {thumbnailPreview && (
                <button
                  type="button"
                  onClick={() => handleThumbnailChange(null)}
                  className="text-xs text-destructive hover:underline"
                  disabled={isPending}
                >
                  Remove
                </button>
              )}
            </div>
            {thumbnailPreview ? (
              <div className="mt-2 rounded-md overflow-hidden border border-border max-w-[300px]">
                <img
                  src={thumbnailPreview}
                  alt="Course cover preview"
                  className="w-full h-auto object-cover"
                />
              </div>
            ) : (
              <span className="block text-[10px] text-muted-foreground">
                Optional. Upload a cover image that appears on the course card.
              </span>
            )}
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
