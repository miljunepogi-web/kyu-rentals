import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/config/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Legacy auth route /login redirects to /admin
  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Admin route protection & entry point handling
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin") {
      if (user) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        return NextResponse.redirect(url);
      }
      // Unauthenticated access to /admin renders the login form directly
      return supabaseResponse;
    }

    // Protect all /admin/* sub-routes (/admin/dashboard, /admin/bookings, etc.)
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Server-Side Admin Role Authorization Verification (Sprint 8 Task #2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userRoles } = await (supabase.from("user_roles") as any)
      .select("role_id")
      .eq("user_id", user.id);

    let isAdmin = false;
    if (userRoles && userRoles.length > 0) {
      const roleIds = userRoles.map((r: { role_id: string }) => r.role_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: validRoles } = await (supabase.from("roles") as any)
        .select("name")
        .in("id", roleIds)
        .in("name", ["admin", "super_admin", "franchise_owner", "support_staff"]);

      if (validRoles && validRoles.length > 0) {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
