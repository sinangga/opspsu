import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  let origin = "";
  let next = "/admin";
  let code: string | null = null;

  try {
    const requestUrl = new URL(request.url);
    code = requestUrl.searchParams.get("code");
    next = requestUrl.searchParams.get("next") ?? "/admin";
    
    // Handle proxy headers to ensure we redirect to the correct domain
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(':', '');
    
    // If behind Nginx, host usually has the domain. If local, it has localhost:3001
    origin = `${protocol}://${host}`;
    
    console.log(`[Callback] Request URL: ${request.url}`);
    console.log(`[Callback] Resolved Origin: ${origin}`);
  } catch (e) {
    console.error("URL parsing error:", e);
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      
      console.error("Supabase Auth Error:", error.message);
      return NextResponse.redirect(`${origin}/admin/login?error=auth-code-error&details=${encodeURIComponent(error.message)}`);
    } catch (err) {
      console.error("Callback crash:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      // If origin is valid, redirect, otherwise return text
      if (origin) {
         return NextResponse.redirect(`${origin}/admin/login?error=auth-code-error&details=${encodeURIComponent(errorMessage)}`);
      }
      return new NextResponse(`Auth Error: ${errorMessage}`, { status: 500 });
    }
  }

  // Jika gagal, arahkan kembali ke login di domain yang benar
  if (origin) {
      return NextResponse.redirect(`${origin}/admin/login?error=auth-code-error&details=no_code`);
  }
  return new NextResponse("Missing auth code", { status: 400 });
}
