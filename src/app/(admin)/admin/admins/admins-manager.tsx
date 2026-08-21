"use client";

import { searchPromotableUsers, updateAdminRole } from "@/actions/admin/admins";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Search,
  ShieldCheck,
  UserCog,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface AdminAccount {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  created_at: string;
}

interface PromotableUser {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
}

interface AdminsManagerProps {
  admins: AdminAccount[];
  currentAdminId: string;
}

export default function AdminsManager({ admins, currentAdminId }: AdminsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Demote confirmation
  const [demoteTarget, setDemoteTarget] = useState<AdminAccount | null>(null);

  // Promote search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromotableUser[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const isLastAdmin = admins.length <= 1;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    startTransition(async () => {
      const res = await searchPromotableUsers(query);
      setSearching(false);
      if (!res.success) {
        toast.error(res.error);
        setResults([]);
        setSearched(true);
        return;
      }
      setResults(res.data);
      setSearched(true);
    });
  }

  function handlePromote(userId: string) {
    startTransition(async () => {
      const res = await updateAdminRole(userId, "admin");
      if (res.success) {
        toast.success("User promoted to administrator.");
        setQuery("");
        setResults([]);
        setSearched(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDemote() {
    if (!demoteTarget) return;

    startTransition(async () => {
      const res = await updateAdminRole(demoteTarget.id, "student");
      if (res.success) {
        toast.success("Administrator demoted to student.");
        setDemoteTarget(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Administrator Accounts */}
      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Administrator Accounts ({admins.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Everyone with access to the admin panel. At least one administrator must always remain.
          </p>
        </header>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Administrator</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => {
                const isSelf = admin.id === currentAdminId;
                return (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col text-xs truncate max-w-sm">
                          <span className="font-semibold text-foreground flex items-center gap-2">
                            {admin.display_name || "Administrator"}
                            {isSelf && (
                              <Badge variant="secondary" className="text-[10px] px-1.5">
                                You
                              </Badge>
                            )}
                          </span>
                          <span className="text-muted-foreground">{admin.email || "No Email"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {admin.username || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(admin.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending || isLastAdmin}
                        onClick={() => setDemoteTarget(admin)}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={
                          isLastAdmin
                            ? "Cannot demote the last administrator"
                            : "Demote to student"
                        }
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5" />
                        Demote
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Promote a Student */}
      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <UserCog className="w-4 h-4 text-primary" />
            Promote a Student
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search student accounts and grant them administrator access.
          </p>
        </header>

        <div className="p-5">
          <form onSubmit={handleSearch} className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="promote-search" className="text-xs font-semibold">
                Search by name, email, or username
              </Label>
              <Input
                id="promote-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. jane@example.com"
                disabled={isPending}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={isPending || !query.trim() || searching}
              className="h-10 flex items-center gap-2"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </Button>
          </form>

          {searched && (
            <div className="mt-4">
              {results.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    No students match “{query}”.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((user) => (
                    <div
                      key={user.id}
                      className="border border-border rounded-lg p-3 bg-card flex items-center justify-between gap-3"
                    >
                      <div className="text-xs min-w-0">
                        <span className="font-semibold text-foreground block truncate">
                          {user.display_name || "Anonymous Student"}
                        </span>
                        <span className="text-muted-foreground block truncate">
                          {user.email || "No Email"}
                          {user.username ? ` · @${user.username}` : ""}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handlePromote(user.id)}
                        className="h-8 flex items-center gap-1.5 text-xs shrink-0"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 text-primary" />
                        Promote
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── DEMOTE CONFIRMATION ─────────────────────────────────── */}
      <AlertDialog open={demoteTarget !== null} onOpenChange={(open) => !open && setDemoteTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Demote this administrator?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {demoteTarget?.display_name || "This administrator"}
              </span>{" "}
              will lose access to the admin panel and become a regular student account. This can be
              reversed by promoting them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={() => handleDemote()}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Demote to Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
