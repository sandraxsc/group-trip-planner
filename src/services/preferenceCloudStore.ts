import type { MemberPreference } from "../types/preference";
import { getSupabaseClient } from "../config/supabaseClient";

type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string };

function sb() {
  return getSupabaseClient();
}

export function isPreferenceCloudEnabled(): boolean {
  return sb() != null;
}

export async function cloudUpsertMemberPreference(pref: MemberPreference): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  // Requires a unique constraint on (tripId, memberId) or a composite primary key.
  const { error } = await client.from("member_preferences").upsert(pref, { onConflict: "tripId,memberId" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function cloudGetPreferencesByTripId(tripId: string): Promise<CloudResult<MemberPreference[]>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("member_preferences").select("*").eq("tripId", tripId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as MemberPreference[]) ?? [] };
}

