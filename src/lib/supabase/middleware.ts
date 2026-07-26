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
    // 1. Unauthenticated users can only view /admin login form
    if (!user) {
      if (pathname === "/admin") {
        return supabaseResponse;
      }
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    const { data: hasAdminAccess } = await supabase.rpc("is_admin_staff");

    if (!hasAdminAccess) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // 2. Staff users on /admin entry point are forwarded directly to /admin/dashboard
    if (pathname === "/admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }

    // 3. Staff users accessing /admin/* sub-routes are allowed
    return supabaseResponse;
  }

  return supabaseResponse;
}
