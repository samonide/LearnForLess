"use client";

import { grantCourseAccess, revokeCourseAccess } from "@/actions/admin/users";
import { generateRecoveryToken } from "@/actions/student/recovery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    User,
    XCircle
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                      className="flex items-center gap-1.5 h-8 text-xs border-border"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Access
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader className="border-b border-border pb-4">
              <SheetTitle className="text-lg">Access Profiles</SheetTitle>
              <SheetDescription className="text-xs">
                Manage course memberships for {selectedUser.display_name || "Student"}.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 pt-5">
              {/* User Bio Card */}
              <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-lg border border-border">
                <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-xs truncate">
                  <span className="font-semibold text-foreground block">
                    {selectedUser.display_name || "Anonymous Student"}
                  </span>
                  <span className="text-muted-foreground block truncate">{selectedUser.email || "No Email"}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">
                    ID: {selectedUser.id}
                  </span>
                </div>
              </div>

              {/* Current Memberships */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 border-b border-border pb-1">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Active Courses ({selectedUser.user_courses?.length ?? 0})
                </h3>

                {selectedUser.user_courses?.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No active course memberships assigned.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedUser.user_courses.map((uc) => {
                      const courseTitle = uc.courses?.title || "Unknown Course";
                      return (
                        <div
                          key={uc.course_id}
                          className="border border-border rounded-lg p-3 bg-card flex items-center justify-between gap-3"
                        >
                          <div className="text-xs">
                            <span className="font-semibold text-foreground block">
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
                            size="icon"
                            disabled={isPending}
                            onClick={() => handleRevokeAccess(uc.course_id)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                            title="Revoke Course Access"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Grant Manual Membership */}
              {selectedUser.role !== "admin" && (
                <Card className="border border-border">
                  <CardHeader className="p-4 pb-2 bg-muted/20 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-primary" />
                      Grant Course Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-4">
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
                          <SelectTrigger id="grant-course">
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
                  </CardContent>
                </Card>
              )}

              {/* Issue Recovery Token */}
              {selectedUser.role !== "admin" && (
                <Card className="border border-border">
                  <CardHeader className="p-4 pb-2 bg-muted/20 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-primary" />
                      Issue Recovery Token
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-4">
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
                          disabled={isPending}
                          className="w-full flex items-center justify-center gap-2 h-10 font-semibold"
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
                  </CardContent>
                </Card>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>

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
