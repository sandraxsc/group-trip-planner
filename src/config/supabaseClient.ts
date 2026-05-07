import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string | null {
  const v = (import.meta.env[name] as string | undefined)?.trim();
  return v ? v : null;
}

let cached: SupabaseClient | null | undefined = undefined;

export function getSupabaseClient(): SupabaseClient | null {
  // Avoid multiple GoTrueClient instances sharing the same storage key.
  if (cached !== undefined) return cached;
  const url = env("VITE_SUPABASE_URL");
  const anonKey = env("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    cached = null;
    return cached;
  }
  cached = createClient(url, anonKey);
  return cached;
}

