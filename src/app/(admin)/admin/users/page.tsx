import { getUsers } from "@/actions/admin/users";
import { createAdminClient } from "@/lib/supabase/server";
import UsersList from "./users-list";

export const dynamic = "force-dynamic";

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const pageSize = 20;

  const result = await getUsers(page, pageSize);
  const adminClient = createAdminClient();

  // Fetch all published courses for manual grant selection option
  const { data: courses } = await adminClient
    .from("courses")
    .select("id, title, status")
    .eq("status", "published")
    .order("title", { ascending: true });

  if (!result.success) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading users directory: {result.error}
      </div>
    );
  }

  const users = result.data;
  const total = result.total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Users
          </h1>
          <p className="text-muted-foreground">
            Review registered students, view last-seen timestamps, and grant or revoke course memberships.
          </p>
        </div>
      </div>

      {/* Interactive Users List */}
      <UsersList
        initialUsers={users as any[]}
        courses={courses ?? []}
        currentPage={page}
        totalCount={total}
        pageSize={pageSize}
      />
    </div>
  );
}
