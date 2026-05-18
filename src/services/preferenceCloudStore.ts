import type { DealBreakerSelection, MemberPreference } from "../types/preference";
import {
  flattenMemberActivityTypes,
  normalizeDealBreakers,
  parseActivityTypesPreference,
} from "../types/preference";
import { getSupabaseClient } from "../config/supabaseClient";

type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Whitelisted columns on public.member_preferences (camelCase).
 * Do not upsert activityTypesOther or other app-only fields — PostgREST returns 400.
 */
type MemberPreferenceCloudRow = {
  memberId: string;
  tripId: string;
  budgetLevel?: string | null;
  energyLevel?: string | null;
  activeHours?: { start: string; end: string } | null;
  activityTypes?: string[];
  selectedPlaces?: string[];
  dealBreakers?: DealBreakerSelection[];
  mbti?: string | null;
};

function sb() {
  return getSupabaseClient();
}

export function isPreferenceCloudEnabled(): boolean {
  return sb() != null;
}

/** Map app preference → Supabase row (jsonb arrays + no extra keys). */
export function memberPreferenceToCloudRow(pref: MemberPreference): MemberPreferenceCloudRow {
  const row: MemberPreferenceCloudRow = {
    memberId: pref.memberId,
    tripId: pref.tripId,
    budgetLevel: pref.budgetLevel ?? null,
    energyLevel: pref.energyLevel ?? null,
    activeHours: pref.activeHours ?? null,
    activityTypes: flattenMemberActivityTypes(pref),
    selectedPlaces: pref.selectedPlaces ?? [],
    dealBreakers: normalizeDealBreakers(pref.dealBreakers) ?? [],
  };
  // Omit mbti when unset — column was added after initial schema (see supabase/sql/member_preferences.sql).
  const mbti = pref.mbti?.trim();
  if (mbti) row.mbti = mbti;
  return row;
}

export function memberPreferenceFromCloudRow(row: MemberPreferenceCloudRow): MemberPreference {
  const dealBreakers = normalizeDealBreakers(row.dealBreakers);
  const { selectedIds, otherNote } = parseActivityTypesPreference({
    activityTypes: row.activityTypes,
  });
  const activityTypes = selectedIds.filter((id) => id !== "other");
  const hasOther = selectedIds.includes("other");
  return {
    memberId: row.memberId,
    tripId: row.tripId,
    budgetLevel: (row.budgetLevel as MemberPreference["budgetLevel"]) ?? undefined,
    energyLevel: (row.energyLevel as MemberPreference["energyLevel"]) ?? undefined,
    activeHours: row.activeHours ?? undefined,
    activityTypes: hasOther ? [...activityTypes, "other"] : activityTypes,
    ...(otherNote ? { activityTypesOther: otherNote } : {}),
    selectedPlaces: row.selectedPlaces ?? [],
    dealBreakers,
    mbti: row.mbti ?? null,
  };
}

function formatCloudError(error: { message?: string; details?: string; hint?: string }): string {
  return [error.message, error.details, error.hint].filter(Boolean).join(" — ");
}

export async function cloudUpsertMemberPreference(pref: MemberPreference): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const row = memberPreferenceToCloudRow(pref);
  const { error } = await client
    .from("member_preferences")
    .upsert(row, { onConflict: "tripId,memberId" });
  if (error) {
    const msg = formatCloudError(error);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[preferenceCloudStore] upsert failed", msg, row);
    }
    return { ok: false, error: msg };
  }
  return { ok: true, data: null };
}

export async function cloudGetPreferencesByTripId(tripId: string): Promise<CloudResult<MemberPreference[]>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("member_preferences").select("*").eq("tripId", tripId);
  if (error) return { ok: false, error: formatCloudError(error) };
  const rows = (data as MemberPreferenceCloudRow[] | null) ?? [];
  return { ok: true, data: rows.map(memberPreferenceFromCloudRow) };
}
