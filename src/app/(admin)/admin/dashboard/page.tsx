import { getAdminStats, getRecentAuditLogs } from "@/actions/admin/users";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const statsResult = await getAdminStats();
  const auditLogsResult = await getRecentAuditLogs(10);

  // Fetch recent token activations (student_access) directly with admin client
  const adminClient = createAdminClient();
  const { data: tokenActivity } = await adminClient
    .from("student_access")
    .select(`
      created_at,
      profiles(email, display_name),
      access_tokens(name, token_hint, is_active)
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  const stats = statsResult.success ? statsResult.data : {
    total_courses: 0,
    published_courses: 0,
    total_modules: 0,
    total_lessons: 0,
    active_tokens: 0,
    total_students: 0,
  };

  const auditLogs = auditLogsResult.success ? auditLogsResult.data : [];

  return (
    <div className="space-y-10">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Platform-wide status, access-token activity, and administrative actions.
        </p>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {[
          { label: "Courses", value: stats.total_courses, sub: `${stats.published_courses} published` },
          { label: "Modules", value: stats.total_modules, sub: "Across all courses" },
          { label: "Lessons", value: stats.total_lessons, sub: "Published + draft" },
          { label: "Active Tokens", value: stats.active_tokens, sub: "Valid access codes" },
          { label: "Students", value: stats.total_students, sub: "Redeemed accounts" },
        ].map((item) => (
          <div key={item.label} className="bg-card p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {item.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {item.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Activity Logs Split Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Token Activations */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Recent Token Activations
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Access codes claimed through the student portal.
            </p>
          </header>
          {!tokenActivity || tokenActivity.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No token redemptions recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Claimed</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokenActivity.map((activity: any, idx: number) => {
                  const profile = activity.profiles as { email?: string | null; display_name?: string | null } | null;
                  const token = activity.access_tokens as { name?: string; token_hint?: string | null; is_active?: boolean } | null;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs text-foreground">
                        {token?.name || "Unknown"}
                        {token?.token_hint && (
                          <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-muted-foreground ml-2">
                            {token.token_hint}…
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {profile?.display_name || profile?.email || "Anonymous Student"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(activity.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={token?.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0.5">
                          {token?.is_active ? "Active" : "Revoked"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        {/* Recent Admin Audit Logs */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Administrative Activity
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Secured record of actions taken by managers.
            </p>
          </header>
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No administrative activity logged yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Administrator</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">Date / Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log: any) => {
                  const admin = log.profiles as { email?: string | null; display_name?: string | null } | null;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        <span className="font-semibold text-foreground">
                          {admin?.display_name || "Admin"}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {admin?.email}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs uppercase text-primary">
                        {log.action.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {log.entity_type}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums text-right">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}
