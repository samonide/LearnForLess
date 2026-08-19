import { getTokensWithCourses } from "@/actions/admin/tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Calendar, Key, PlusCircle } from "lucide-react";
import Link from "next/link";
import TokenRowActions from "./token-row-actions";

export const dynamic = "force-dynamic";

export default async function AdminTokensPage() {
  const result = await getTokensWithCourses();

  if (!result.success) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading access tokens: {result.error}
      </div>
    );
  }

  const tokens = result.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Access Tokens
          </h1>
          <p className="text-muted-foreground">
            Each token grants one student account access to courses.
          </p>
        </div>
        <Link href="/admin/tokens/new" className="shrink-0">
          <Button className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            Generate Token
          </Button>
        </Link>
      </div>

      {/* Table grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {tokens.length === 0 ? (
          <div className="px-6 py-20 text-center space-y-4">
            <Key className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <h3 className="font-semibold text-lg">No tokens yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Create your first student token to grant course access.
            </p>
            <Link href="/admin/tokens/new" className="inline-block pt-2">
              <Button className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Generate Token
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Token Name</TableHead>
                <TableHead>Hint</TableHead>
                <TableHead className="max-w-[200px]">Assigned Courses</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => {
                // Map courses
                const coursesList = (token.token_courses as any[])?.map(
                  (tc) => tc.courses?.title
                ).filter(Boolean) || [];

                return (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium text-foreground">
                      {token.name}
                      {token.description && (
                        <span className="block text-xs font-normal text-muted-foreground mt-0.5 line-clamp-1">
                          {token.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {token.token_hint}…
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {coursesList.length === 0 ? (
                        <span className="text-destructive text-xs">No courses selected</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {coursesList.slice(0, 3).map((title, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px]">
                              {title}
                            </Badge>
                          ))}
                          {coursesList.length > 3 && (
                            <Badge variant="outline" className="text-[10px] bg-muted">
                              +{coursesList.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm tabular-nums text-muted-foreground">
                        {token.current_uses}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {token.expires_at ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(token.expires_at)}
                        </span>
                      ) : (
                        "Never"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={token.is_active ? "default" : "secondary"}
                        className="px-2 py-0.5"
                      >
                        {token.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {token.last_used_at ? formatDateTime(token.last_used_at) : "Never used"}
                    </TableCell>
                    <TableCell className="text-right">
                      <TokenRowActions tokenId={token.id} isActive={token.is_active} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
