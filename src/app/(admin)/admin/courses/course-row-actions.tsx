"use client";

import { deleteCourse, setCourseStatus } from "@/actions/admin/courses";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Archive,
    Edit,
    Globe,
    Lock,
    MoreHorizontal,
    Settings,
    Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

interface CourseRowActionsProps {
  courseId: string;
  currentStatus: "draft" | "published" | "archived";
}

export default function CourseRowActions({
  courseId,
  currentStatus,
}: CourseRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleNavigate(path: string) {
  router.push(path);
}

function handleStatusUpdate(status: "draft" | "published" | "archived") {
    startTransition(async () => {
      const res = await setCourseStatus(courseId, status);
      if (res.success) {
        toast.success(`Course status updated to ${status}.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "Are you absolutely sure you want to delete this course? All modules, lessons, progress logs, and storage assets will be permanently removed. This action is irreversible!"
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteCourse(courseId);
      if (res.success) {
        toast.success("Course deleted successfully.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" disabled={isPending} />}
      >
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleNavigate(`/admin/courses/${courseId}/builder`)}>
          <Settings className="w-4 h-4" />
          Manage Content
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleNavigate(`/admin/courses/${courseId}/edit`)}>
          <Edit className="w-4 h-4" />
          Edit Metadata
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {currentStatus !== "published" && (
          <DropdownMenuItem
            onClick={() => handleStatusUpdate("published")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Globe className="w-4 h-4 text-green-600 dark:text-green-500" />
            <span>Publish Course</span>
          </DropdownMenuItem>
        )}

        {currentStatus === "published" && (
          <DropdownMenuItem
            onClick={() => handleStatusUpdate("draft")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-amber-600" />
            <span>Unpublish (Draft)</span>
          </DropdownMenuItem>
        )}

        {currentStatus !== "archived" && (
          <DropdownMenuItem
            onClick={() => handleStatusUpdate("archived")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Archive className="w-4 h-4 text-slate-500" />
            <span>Archive Course</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDelete}
          className="flex items-center gap-2 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Course</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
