import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isAuthCallback = pathname === "/auth/callback";

  // If the user is logged in and tries to access the login page, redirect to admin dashboard.
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // If the user is not logged in, and not trying to access the login page or the auth callback,
  // redirect them to the login page.
  if (!user && !isLoginPage && !isAuthCallback) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // If a user is logged in but not allowed, redirect them.
  if (user) {
    const ALLOWED_EMAILS = ["yyudie@gmail.com", "stamet.pangsuma@bmkg.go.id"];
    const isAllowed = user.email && ALLOWED_EMAILS.includes(user.email);
    if (!isAllowed) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/callback"],
};