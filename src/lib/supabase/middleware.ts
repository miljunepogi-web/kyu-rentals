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
    if (!user) {
      if (pathname === "/admin") {
        return supabaseResponse;
      }
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Verify if logged-in user has an Admin role
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

    // Entry point /admin handling
    if (pathname === "/admin") {
      if (isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        return NextResponse.redirect(url);
      }
      // Non-admin logged-in user on /admin: allow rendering login page so they can enter Admin credentials
      return supabaseResponse;
    }

    // Sub-routes (/admin/dashboard, /admin/bookings, etc.) require isAdmin = true
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
