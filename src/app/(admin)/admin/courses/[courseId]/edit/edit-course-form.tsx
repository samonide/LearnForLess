"use client";

import { useState, useTransition } from "react";
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
import { updateCourse } from "@/actions/admin/courses";
import { generateSlug } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url || "");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    course.status as any
  );

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
        thumbnail_url: thumbnailUrl || undefined,
        status,
      });

      if (res.success) {
        toast.success("Course metadata updated successfully!");
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

      {/* Thumbnail URL */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-course-thumbnail">Thumbnail URL</Label>
        <Input
          id="edit-course-thumbnail"
          type="url"
          placeholder="https://example.com/image.jpg"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          disabled={isPending}
        />
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
