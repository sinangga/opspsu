import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  let supabase = null;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
       throw new Error("Missing Supabase Env Vars");
    }

    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
  } catch (err) {
    console.error("Middleware Supabase Init Error:", err);
    // If we can't init supabase, we can't protect routes or do auth checks.
    // We should allow access to login page so it can show the config error.
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    // If supabase failed to init, and we are not on login page, redirect to login
    // The login page itself has client-side checks to show the error.
    if (!supabase) {
        if (request.nextUrl.pathname !== "/admin/login") {
            return NextResponse.redirect(new URL("/admin/login?error=config-error", request.url));
        }
        return response;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const ALLOWED_EMAILS = ["yyudie@gmail.com", "stamet.pangsuma@bmkg.go.id"];
      const isAllowed = !!(user?.email && ALLOWED_EMAILS.includes(user.email));

      const isLoginPage = request.nextUrl.pathname === "/admin/login";

      if (isLoginPage) {
        if (user && isAllowed) {
          return NextResponse.redirect(new URL("/admin", request.url));
        }
        return response;
      }

      if (!user || !isAllowed) {
        const url = new URL("/admin/login", request.url);
        if (user && !isAllowed) url.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(url);
      }
    } catch (e) {
      console.error("Middleware error:", e);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/callback"],
};
