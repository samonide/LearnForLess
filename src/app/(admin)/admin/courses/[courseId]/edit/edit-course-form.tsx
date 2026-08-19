"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCourse, uploadCourseThumbnail } from "@/actions/admin/courses";
import { generateSlug } from "@/lib/utils";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import type { Course } from "@/types";

interface EditCourseFormProps {
  course: Course;
}

export default function EditCourseForm({ course }: EditCourseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);
  const [description, setDescription] = useState(course.description || "");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    course.status as any
  );

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  function handleThumbnailChange(file: File | null) {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(file);
    setThumbnailPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a course title.");
      return;
    }

    startTransition(async () => {
      const res = await updateCourse({
        id: course.id,
        title,
        slug,
        description,
        status,
      });

      if (res.success) {
        // Upload new thumbnail if one was selected
        if (thumbnailFile) {
          const uploadRes = await uploadCourseThumbnail(course.id, thumbnailFile);
          if (!uploadRes.success) {
            toast.error(`Metadata saved, but cover image upload failed: ${uploadRes.error}`);
          } else {
            toast.success("Course and cover image updated successfully!");
          }
        } else {
          toast.success("Course metadata updated successfully!");
        }
        router.push("/admin/courses");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-course-title">Course Title *</Label>
        <Input
          id="edit-course-title"
          type="text"
          placeholder="e.g. Next.js Masterclass"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSlug(generateSlug(e.target.value));
          }}
          disabled={isPending}
          required
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-course-slug">URL Slug *</Label>
        <Input
          id="edit-course-slug"
          type="text"
          placeholder="nextjs-masterclass"
          value={slug}
          onChange={(e) => setSlug(generateSlug(e.target.value))}
          disabled={isPending}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-course-description">Description</Label>
        <Textarea
          id="edit-course-description"
          placeholder="Describe what students will learn in this course..."
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
        />
      </div>

      {/* Cover Image */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-course-cover-image">Cover Image</Label>
        <div className="flex items-center gap-4">
          <label
            htmlFor="edit-course-cover-image"
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background hover:bg-accent cursor-pointer text-sm font-medium text-muted-foreground disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            {thumbnailFile ? "Change Image" : course.thumbnail_url ? "Replace Image" : "Upload Image"}
            <input
              id="edit-course-cover-image"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                handleThumbnailChange(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          {(thumbnailPreview || course.thumbnail_url) && (
            <button
              type="button"
              onClick={() => handleThumbnailChange(null)}
              className="text-xs text-destructive hover:underline"
              disabled={isPending}
            >
              Clear selection
            </button>
          )}
        </div>
        {thumbnailPreview ? (
          <div className="mt-2 rounded-md overflow-hidden border border-border max-w-[300px]">
            <img
              src={thumbnailPreview}
              alt="New course cover preview"
              className="w-full h-auto object-cover"
            />
          </div>
        ) : course.thumbnail_url ? (
          <div className="mt-2 rounded-md overflow-hidden border border-border max-w-[300px]">
            <img
              src={course.thumbnail_url}
              alt="Current course cover"
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
        <Label htmlFor="edit-course-status">Publishing Status</Label>
        <Select
          value={status}
          onValueChange={(val: any) => setStatus(val)}
          disabled={isPending}
        >
          <SelectTrigger id="edit-course-status" className="w-full">
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
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  );
}
