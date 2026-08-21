"use client";

import { deleteUser, grantCourseAccess, revokeCourseAccess } from "@/actions/admin/users";
import { generateRecoveryToken } from "@/actions/student/recovery";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
    AlertTriangle,
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Copy,
    Eye,
    GraduationCap,
    KeyRound,
    Loader2,
    PlusCircle,
    ShieldCheck,
    Trash2,
    User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  role: "admin" | "student";
  created_at: string;
  user_courses: {
    course_id: string;
    created_at: string;
    expires_at: string | null;
    courses: {
      id: string;
      title: string;
      status: string;
    } | null;
  }[];
  student_access: {
    last_seen_at: string;
  }[];
}

interface UsersListProps {
  initialUsers: UserProfile[];
  courses: {
    id: string;
    title: string;
    status: string;
  }[];
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected student details sheet state
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [grantCourseId, setGrantCourseId] = useState("");
  const [grantExpiry, setGrantExpiry] = useState("");

  // Recovery token issuance state
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);

  // Revoke confirmation state — revoke stays behind a deliberate confirm
  const [revokeTarget, setRevokeTarget] = useState<{ courseId: string; courseTitle: string } | null>(null);

  // Permanent deletion confirmation state
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const totalPages = Math.ceil(totalCount / pageSize);

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    router.push(`/admin/users?page=${newPage}`);
  }

  // Issue recovery token handler
  function handleIssueRecoveryToken(e: React.FormEvent) {
    e.preventDefault();
    const username = selectedUser?.username;
    if (!selectedUser || !username) {
      toast.error("This user has no username and cannot reset their password.");
      return;
    }

    startTransition(async () => {
      const res = await generateRecoveryToken(username);

      if (!res.success) {
        toast.error("Failed to generate recovery token.");
        return;
      }

      // The action returns a placeholder hint when the username is unknown.
      // Only show the raw token when it is a real generation.
      if (res.hint === "USER") {
        toast.error("Failed to generate recovery token.");
        return;
      }

      setRecoveryToken(res.rawToken);
      toast.success("Recovery token generated!");
    });
  }

  async function handleCopyRecoveryToken() {
    if (!recoveryToken) return;
    try {
      await navigator.clipboard.writeText(recoveryToken);
      setRecoveryCopied(true);
      toast.success("Recovery token copied to clipboard!");
      setTimeout(() => setRecoveryCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please select the text and copy manually.");
    }
  }

  // Grant access handler
  function handleGrantAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !grantCourseId) return;

    startTransition(async () => {
      const res = await grantCourseAccess({
        user_id: selectedUser.id,
        course_id: grantCourseId,
        expires_at: grantExpiry ? new Date(grantExpiry).toISOString() : null,
      });

      if (res.success) {
        toast.success("Course access granted successfully!");
        
        // Sync local selected user state
        const matchedCourse = courses.find((c) => c.id === grantCourseId);
        const updatedCourses = [
          ...selectedUser.user_courses.filter((uc) => uc.course_id !== grantCourseId),
          {
            course_id: grantCourseId,
            created_at: new Date().toISOString(),
            expires_at: grantExpiry ? new Date(grantExpiry).toISOString() : null,
            courses: matchedCourse ? { id: matchedCourse.id, title: matchedCourse.title, status: matchedCourse.status } : null,
          },
        ];

        const updatedUser = { ...selectedUser, user_courses: updatedCourses };
        setSelectedUser(updatedUser);
        
        // Reset inputs
        setGrantCourseId("");
        setGrantExpiry("");

        // Refresh database state
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Revoke access handler
  function handleRevokeAccess(courseId: string) {
    if (!selectedUser) return;
    if (!confirm("Are you sure you want to revoke this student's access to this course?")) return;

    startTransition(async () => {
      const res = await revokeCourseAccess(selectedUser.id, courseId);
      if (res.success) {
        toast.success("Course access revoked.");

        // Sync local selected user state
        const updatedCourses = selectedUser.user_courses.filter((uc) => uc.course_id !== courseId);
        const updatedUser = { ...selectedUser, user_courses: updatedCourses };
        setSelectedUser(updatedUser);
        setRevokeTarget(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Permanent delete handler
  function handleDeleteUser() {
    if (!deleteTarget) return;

    startTransition(async () => {
      const res = await deleteUser(deleteTarget.id);

      if (res.success) {
        toast.success("Student account permanently deleted.");
        if (selectedUser?.id === deleteTarget.id) {
          setSelectedUser(null);
        }
        setDeleteTarget(null);
        setDeleteConfirmText("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Users Table */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>User Account</TableHead>
              <TableHead>System Role</TableHead>
              <TableHead>Active Courses</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialUsers.map((user) => {
              const enrolledCourses = user.user_courses?.length ?? 0;
              const lastSeen = user.student_access?.[0]?.last_seen_at;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                        {user.role === "admin" ? (
                          <ShieldCheck className="w-4 h-4 text-primary" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col text-xs truncate max-w-sm">
                        <span className="font-semibold text-foreground">
                          {user.display_name || "Anonymous Student"}
                        </span>
                        <span className="text-muted-foreground">{user.email || "No Email"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "outline"} className="capitalize text-[10px] px-1.5">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-sm">{enrolledCourses}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDate(user.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {lastSeen ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {formatRelativeTime(lastSeen)}
                      </span>
                    ) : (
                      "Never"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                        className="flex items-center gap-1.5 h-8 text-xs border-border"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Access
                      </Button>
                      {user.role === "student" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(user);
                            setDeleteConfirmText("");
                          }}
                          className="h-8 w-8 px-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete student account"
                          aria-label="Delete student account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalCount} users total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── USER ACCESS MANAGING SHEET (SLIDE OVER) ───────────── */}
      <Sheet open={selectedUser !== null} onOpenChange={(open) => !open && setSelectedUser(null)}>
        {selectedUser && (
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader className="border-b border-border pb-4">
              <SheetTitle className="text-lg">Access Profiles</SheetTitle>
              <SheetDescription className="text-xs">
                Review who this user is, what they have access to, and manage their memberships.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 pt-5">
              {/* WHO — user identity */}
              <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-lg border border-border">
                <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                  {selectedUser.role === "admin" ? (
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs min-w-0">
                  <span className="font-semibold text-foreground block truncate">
                    {selectedUser.display_name || "Anonymous Student"}
                  </span>
                  <span className="text-muted-foreground block truncate">{selectedUser.email || "No Email"}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">
                    ID: {selectedUser.id}
                  </span>
                </div>
                <Badge
                  variant={selectedUser.role === "admin" ? "default" : "outline"}
                  className="capitalize text-[10px] px-1.5 shrink-0 ml-auto"
                >
                  {selectedUser.role}
                </Badge>
              </div>

              {/* HAS — current memberships */}
              <div>
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 border-b border-border pb-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Active Courses ({selectedUser.user_courses?.length ?? 0})
                </h3>

                {selectedUser.user_courses?.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      No active course memberships assigned.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedUser.user_courses.map((uc) => {
                      const courseTitle = uc.courses?.title || "Unknown Course";
                      return (
                        <div
                          key={uc.course_id}
                          className="border border-border rounded-lg p-3 bg-card flex items-center justify-between gap-3"
                        >
                          <div className="text-xs min-w-0">
                            <span className="font-semibold text-foreground block truncate">
                              {courseTitle}
                            </span>
                            {uc.expires_at ? (
                              <span className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                Expires {formatDate(uc.expires_at)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-green-600 dark:text-green-500 font-semibold block mt-0.5">
                                Lifetime Access
                              </span>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => setRevokeTarget({ courseId: uc.course_id, courseTitle })}
                            className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            Revoke
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CAN — grant a new membership, connected to the list above */}
              {selectedUser.role !== "admin" && (
                <div className="border border-border rounded-xl bg-card">
                  <div className="border-b border-border bg-muted/20 px-4 py-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-primary" />
                      Grant Course Access
                    </h3>
                  </div>
                  <div className="p-4">
                    <form onSubmit={handleGrantAccess} className="space-y-4">
                      {/* Course dropdown */}
                      <div className="space-y-1.5 text-left">
                        <Label htmlFor="grant-course">Select Course *</Label>
                        <Select
                          value={grantCourseId}
                          onValueChange={(value) => setGrantCourseId(value ?? "")}
                          disabled={isPending}
                          required
                        >
                          <SelectTrigger id="grant-course" className="w-full">
                            <SelectValue placeholder="Choose course..." />
                          </SelectTrigger>
                          <SelectContent>
                            {courses
                              // Filter courses student already has access to
                              .filter((c) => !selectedUser.user_courses.some((uc) => uc.course_id === c.id))
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.title}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {courses.length === 0 || courses.every((c) => selectedUser.user_courses.some((uc) => uc.course_id === c.id)) ? (
                          <span className="block text-[10px] text-muted-foreground">
                            All published courses are already assigned to this student.
                          </span>
                        ) : null}
                      </div>

                      {/* Expiration date */}
                      <div className="space-y-1.5 text-left">
                        <Label htmlFor="grant-expiry">Optional Expiry Date</Label>
                        <Input
                          id="grant-expiry"
                          type="date"
                          value={grantExpiry}
                          onChange={(e) => setGrantExpiry(e.target.value)}
                          disabled={isPending}
                          min={new Date().toISOString().split("T")[0]}
                        />
                        <span className="block text-[10px] text-muted-foreground">
                          Leave blank for indefinite lifetime memberships.
                        </span>
                      </div>

                      <Button
                        type="submit"
                        disabled={isPending || !grantCourseId}
                        className="w-full flex items-center justify-center gap-2 h-10 font-semibold"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span>Grant Membership</span>
                        )}
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {/* Recovery token — muted, contextual action */}
              {selectedUser.role !== "admin" && (
                <div className="border border-border rounded-xl bg-card">
                  <div className="border-b border-border bg-muted/20 px-4 py-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-primary" />
                      Password Recovery
                    </h3>
                  </div>
                  <div className="p-4">
                    {selectedUser.username ? (
                      <form onSubmit={handleIssueRecoveryToken} className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Generate a one-time recovery token for{" "}
                          <span className="font-semibold text-foreground">
                            {selectedUser.username}
                          </span>
                          . The student enters it at{" "}
                          <span className="font-mono text-[10px]">/recover</span>{" "}
                          to set a new password. Valid for 24 hours.
                        </p>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={isPending}
                          className="w-full flex items-center justify-center gap-2 h-10"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <KeyRound className="w-4 h-4" />
                              Generate Recovery Token
                            </>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        This user has no username and cannot use password recovery.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* ── REVOKE ACCESS CONFIRMATION ─────────────────────────── */}
      <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke course access?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing{" "}
              <span className="font-medium text-foreground">
                {revokeTarget?.courseTitle || "this course"}
              </span>{" "}
              means {selectedUser?.display_name || "this student"} will lose access to it immediately. This can be
              undone by granting access again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={() => revokeTarget && handleRevokeAccess(revokeTarget.courseId)}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── PERMANENT DELETE CONFIRMATION ─────────────────────── */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 bg-destructive/10 border border-destructive/30 rounded-full flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-semibold">
              Permanently delete this student?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <span className="font-semibold text-foreground">
                {deleteTarget?.display_name || deleteTarget?.email || "This student"}
              </span>{" "}
              will be <span className="font-semibold text-destructive">permanently removed</span> along with:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>• Their profile and login account</p>
            <p>• All course memberships and lesson progress</p>
            <p>• Token redemption and access history</p>
          </div>

          <p className="text-xs text-muted-foreground text-center -mt-1">
            This action <span className="font-semibold text-destructive">cannot be undone</span>. Type{" "}
            <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
          </p>

          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            disabled={isPending}
            autoFocus
            className="text-center font-mono"
          />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending || deleteConfirmText !== "DELETE"}
              onClick={() => handleDeleteUser()}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── ONE TIME RECOVERY TOKEN MODAL ──────────────────────── */}
      <Dialog open={recoveryToken !== null} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-muted border border-border rounded-full flex items-center justify-center mb-2">
              <KeyRound className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Recovery Token Generated
            </DialogTitle>
            <DialogDescription className="text-center font-medium text-destructive dark:text-red-400 flex items-center gap-1.5 justify-center mt-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              This token will only be shown ONCE. Copy it now.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="bg-muted/30 border border-border p-4 rounded-lg text-center select-all font-mono text-lg font-semibold tracking-wider text-primary break-all">
              {recoveryToken}
            </div>

            <Button
              onClick={handleCopyRecoveryToken}
              className="w-full flex items-center justify-center gap-2 h-11"
            >
              {recoveryCopied ? (
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
            <Button
              onClick={() => setRecoveryToken(null)}
              className="w-full"
              variant="outline"
            >
              I have copied the token. Close.
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
