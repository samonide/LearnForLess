"use client";

import { grantCourseAccess, revokeCourseAccess } from "@/actions/admin/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { Course, User } from "@/types";
import { GraduationCap, Loader2, Mail, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface UsersListProps {
  initialUsers: User[];
  courses: Course[];
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

export default function UsersList({
  initialUsers,
  courses,
  currentPage,
  totalCount,
  pageSize,
}: UsersListProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isPending, startTransition] = useTransition();
  
  // Modal state for grant access
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [grantExpiry, setGrantExpiry] = useState("");

  function handleGrantClick(user: User) {
    setSelectedUser(user);
    setSelectedCourseId("");
    setGrantExpiry("");
    setShowGrantModal(true);
  }

  function handleGrantSubmit() {
    if (!selectedUser || !selectedCourseId) {
      toast.error("Please select a course.");
      return;
    }

    startTransition(async () => {
      const result = await grantCourseAccess({
        user_id: selectedUser.id,
        course_id: selectedCourseId,
        expires_at: grantExpiry ? new Date(grantExpiry).toISOString() : undefined,
      });

      if (result.success) {
        toast.success("Course access granted!");
        setShowGrantModal(false);
        // Refresh data
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRevoke(userId: string, courseId: string) {
    if (!confirm("Are you sure you want to revoke access to this course?")) {
      return;
    }

    startTransition(async () => {
      const result = await revokeCourseAccess(userId, courseId);

      if (result.success) {
        toast.success("Course access revoked!");
        // Refresh data
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <h3 className="font-semibold text-lg">No Students Yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Students will appear here once they redeem an access token on the portal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Enrolled Courses</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const userCourses = (user.user_courses as any[]) || [];
                const coursesTitles = userCourses
                  .map((uc) => (uc.courses as any)?.title)
                  .filter(Boolean);

                // Get last activity timestamp
                const lastActivity = (user.student_access as any[])?.[0]?.last_seen_at;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">
                      {user.display_name || "No Name"}
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        ID: {user.id.slice(0, 8)}...
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email || "No Email"}
                    </TableCell>
                    <TableCell>
                      {coursesTitles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No courses</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {coursesTitles.slice(0, 2).map((title, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px]">
                              {title}
                            </Badge>
                          ))}
                          {coursesTitles.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{coursesTitles.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lastActivity ? formatDateTime(lastActivity) : "Never"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGrantClick(user)}
                        disabled={isPending}
                        className="text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Grant
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {Math.ceil(totalCount / pageSize)}
          </span>
        </div>
      )}

      {/* Grant Course Access Modal */}
      <Dialog open={showGrantModal} onOpenChange={setShowGrantModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Course Access</DialogTitle>
            <DialogDescription>
              Assign a course to {selectedUser?.display_name || "this student"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Course Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Select Course *</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={isPending}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground text-sm"
              >
                <option value="">Choose a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiration (Optional) */}
            <div className="space-y-2">
              <label htmlFor="grant-expiry" className="text-sm font-semibold text-foreground">
                Expiration Date (Optional)
              </label>
              <input
                id="grant-expiry"
                type="datetime-local"
                value={grantExpiry}
                onChange={(e) => setGrantExpiry(e.target.value)}
                disabled={isPending}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground text-sm"
              />
              <span className="text-[10px] text-muted-foreground">
                Leave blank for permanent access.
              </span>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowGrantModal(false)}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGrantSubmit}
                disabled={isPending || !selectedCourseId}
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Granting...
                  </>
                ) : (
                  "Grant Access"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
