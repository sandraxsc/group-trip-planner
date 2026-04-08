import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string | null {
  const v = (import.meta.env[name] as string | undefined)?.trim();
  return v ? v : null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const url = env("VITE_SUPABASE_URL");
  const anonKey = env("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

