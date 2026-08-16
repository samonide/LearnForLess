import { getAdminStats, getRecentAuditLogs } from "@/actions/admin/users";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import {
    Activity,
    BookOpen,
    FileCode,
    GraduationCap,
    Key,
    Layers,
    ShieldCheck,
    UserCheck,
} from "lucide-react";

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
    <div className="space-y-8">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-8 h-8 text-primary" />
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground">
          Platform-wide status metrics, access tokens, and administrative activity logs.
        </p>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Courses */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Courses
            </CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.total_courses}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {stats.published_courses} published
            </p>
          </CardContent>
        </Card>

        {/* Modules */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Modules
            </CardTitle>
            <Layers className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.total_modules}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Across all courses
            </p>
          </CardContent>
        </Card>

        {/* Lessons */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Lessons
            </CardTitle>
            <FileCode className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.total_lessons}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Learning modules
            </p>
          </CardContent>
        </Card>

        {/* Active Tokens */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Active Tokens
            </CardTitle>
            <Key className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.active_tokens}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Valid access codes
            </p>
          </CardContent>
        </Card>

        {/* Students */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Students
            </CardTitle>
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.total_students}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Redeemed accounts
            </p>
          </CardContent>
        </Card>

        {/* Admins */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              System Health
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm font-bold text-green-600 dark:text-green-500 flex items-center gap-1 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              Online
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Secure TLS active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Logs Split Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Token Activations */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Recent Token Activations
            </CardTitle>
            <CardDescription>
              Monitor which tokens have been claimed by student portals.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!tokenActivity || tokenActivity.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No token redemptions recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token Name</TableHead>
                    <TableHead>Student Account</TableHead>
                    <TableHead>Claim Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenActivity.map((activity: any, idx: number) => {
                    const profile = activity.profiles as { email?: string | null; display_name?: string | null } | null;
                    const token = activity.access_tokens as { name?: string; token_hint?: string | null; is_active?: boolean } | null;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold text-xs text-foreground">
                          {token?.name || "Unknown"}
                          {token?.token_hint && (
                            <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-muted-foreground ml-2">
                              {token.token_hint}...
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {profile?.display_name || profile?.email || "Anonymous Student"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(activity.created_at)}
                        </TableCell>
                        <TableCell>
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
          </CardContent>
        </Card>

        {/* Recent Admin Audit Logs */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Administrative Audit Logs
            </CardTitle>
            <CardDescription>
              Secured record of actions executed by managers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No administrative audit logs available.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Administrator</TableHead>
                    <TableHead>Action Execution</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Date / Time</TableHead>
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
                        <TableCell className="text-xs font-semibold">
                          {log.entity_type}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
