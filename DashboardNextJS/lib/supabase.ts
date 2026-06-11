import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables are missing! Check .env.local");
} else if (!supabaseKey.startsWith("ey")) {
  console.warn("WARNING: Supabase Key in .env.local does not start with 'ey'. It likely is not a valid JWT, which will cause 'Invalid Compact JWS' errors. Check Project Settings > API > anon public key.");
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "")