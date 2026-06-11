import { NextRequest } from "next/server";

export function getBaseUrl(req: NextRequest): string {
  // 1. Check environment variable (most reliable if set correctly)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  // 2. Fallback to request headers
  const host = req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto")?.split(',')[0] || "http";
  
  if (host) {
    return `${protocol}://${host}`;
  }

  // 3. Last resort (shouldn't happen in valid request)
  return "http://localhost:3000";
}