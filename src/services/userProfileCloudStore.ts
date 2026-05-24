import { getSupabaseClient } from "../config/supabaseClient";
import type { UserProfile } from "../types/userProfile";

/**
 * Best-effort Supabase persistence for the local user profile.
 *
 * We don't ship a `user_profiles` table by default — many environments will
 * not have it, so every helper guards on `getSupabaseClient()` returning null
 * AND swallows table-missing / permission errors. Local storage stays the
 * source of truth; cloud sync simply lights up if the table exists.
 *
 * Expected table shape (id is primary key):
 *   id text primary key, name text not null, createdAt text, updatedAt text
 */

function sb() {
  return getSupabaseClient();
}

export function isUserProfileCloudEnabled(): boolean {
  return sb() !== null;
}

export async function cloudUpsertUserProfile(profile: UserProfile): Promise<{ ok: boolean; error?: string }> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const row = {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  try {
    const { error } = await client
      .from("user_profiles")
      .upsert(row, { onConflict: "id" });
    if (error) {
      // Table missing or permission denied → log and degrade gracefully.
      // Treating cloud as best-effort means the UI flow keeps working when
      // the user_profiles table hasn't been created yet.
      // eslint-disable-next-line no-console
      console.warn("[userProfileCloudStore] upsert failed", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[userProfileCloudStore] upsert threw", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cloudGetUserProfile(id: string): Promise<UserProfile | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return (data as UserProfile | null) ?? null;
  } catch {
    return null;
  }
}
