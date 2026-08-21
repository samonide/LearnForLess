import { getAdmins } from "@/actions/admin/admins";
import { createClient } from "@/lib/supabase/server";
import AdminsManager from "./admins-manager";

export const dynamic = "force-dynamic";

export default async function AdminAdminsPage() {
  const [adminsResult, supabase] = await Promise.all([
    getAdmins(),
    createClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admins = adminsResult.success ? (adminsResult.data as any[]) : [];
  const currentAdminId = user?.id ?? "";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Admin Accounts
        </h1>
        <p className="text-muted-foreground">
          Manage who has access to the admin panel. Promote students or demote administrators.
        </p>
      </div>

      <AdminsManager admins={admins} currentAdminId={currentAdminId} />
    </div>
  );
}
