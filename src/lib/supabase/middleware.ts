import type { Database } from "@/types/database";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Protect admin routes ───────────────────────────────────
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // Check admin role server-side
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as any;

    if (!profile || profile.role !== "admin") {
      // Not an admin — redirect to student dashboard or access page
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── Protect student routes ─────────────────────────────────
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/course")
  ) {
    if (!user) {
      return NextResponse.redirect(new URL("/access", request.url));
    }
  }

  // ── Admin login redirect if already logged in ──────────────
  if (pathname === "/admin/login" && user) {
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as any;

    if (profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  // ── Root redirect ──────────────────────────────────────────
  // Keep the student access flow as the default public entry point.
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/access", request.url));
  }

  return supabaseResponse;
}
