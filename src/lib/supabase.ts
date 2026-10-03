import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(url && key);

// Falls back to a placeholder so the app still builds/renders (and shows a
// setup banner) before the environment variables are filled in.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-key",
  { auth: { persistSession: false, autoRefreshToken: false } }
);
