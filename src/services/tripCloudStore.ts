import type { Trip, TripFlight, TripHotel, TripInvite, TripMember } from "../types/trip";
import { getSupabaseClient } from "../config/supabaseClient";

type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string };

function sb() {
  return getSupabaseClient();
}

export function isCloudEnabled(): boolean {
  return sb() != null;
}

export async function cloudCreateTripBundle(args: {
  trip: Trip;
  invite: TripInvite;
  owner: TripMember;
}): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error: tripErr } = await client.from("trips").insert(args.trip);
  if (tripErr) return { ok: false, error: tripErr.message };

  const { error: inviteErr } = await client.from("trip_invites").insert(args.invite);
  if (inviteErr) return { ok: false, error: inviteErr.message };

  const { error: ownerErr } = await client.from("trip_members").insert(args.owner);
  if (ownerErr) return { ok: false, error: ownerErr.message };

  return { ok: true, data: null };
}

export async function cloudGetInviteByToken(token: string): Promise<CloudResult<TripInvite | null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client
    .from("trip_invites")
    .select("*")
    .eq("token", token)
    .eq("isActive", true)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as TripInvite | null) ?? null };
}

export async function cloudGetTripById(tripId: string): Promise<CloudResult<Trip | null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as Trip | null) ?? null };
}

export async function cloudGetTripMembers(tripId: string): Promise<CloudResult<TripMember[]>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("trip_members").select("*").eq("tripId", tripId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as TripMember[]) ?? [] };
}

export async function cloudAddTripMember(member: TripMember): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error } = await client.from("trip_members").insert(member);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/**
 * Patch a subset of fields on the trips row. We intentionally only allow
 * the fields the in-app editor exposes today (name / tripDays / maxGuests /
 * startDate / destination) so a typo can't accidentally rewrite ids.
 */
export async function cloudUpdateTrip(args: {
  tripId: string;
  patch: Partial<
    Pick<Trip, "name" | "tripDays" | "maxGuests" | "startDate" | "destination" | "groupType">
  >;
}): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  if (!Object.keys(args.patch).length) return { ok: true, data: null };

  const { error } = await client.from("trips").update(args.patch).eq("id", args.tripId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function cloudUpdateMemberPreferenceStatus(args: {
  memberId: string;
  tripId: string;
  preferenceStatus: TripMember["preferenceStatus"];
}): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error } = await client
    .from("trip_members")
    .update({ preferenceStatus: args.preferenceStatus })
    .eq("id", args.memberId)
    .eq("tripId", args.tripId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/**
 * Log a cloud sync failure to the dev console. Production stays quiet so we
 * don't pollute analytics, but in dev a missing table or column casing bug
 * (the most common cause of "data didn't save") shows up loudly. Kept here
 * so all hotel/flight helpers share one message format.
 */
function logCloudFailure(op: string, error: { message: string; code?: string }) {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.warn(
    `[cloudStore] ${op} failed — check Supabase table exists and column casing matches the TS type. ` +
      `If you see "relation does not exist", run the matching SQL from supabase/sql/. ` +
      `Details: ${error.message}${error.code ? ` (${error.code})` : ""}`
  );
}

/**
 * List all hotels saved for a trip. Best-effort: returns `ok: false` when the
 * cloud client is disabled or the request fails; callers should fall back to
 * their local cache silently.
 */
export async function cloudListTripHotels(tripId: string): Promise<CloudResult<TripHotel[]>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("trip_hotels").select("*").eq("tripId", tripId);
  if (error) {
    logCloudFailure("cloudListTripHotels", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: (data as TripHotel[]) ?? [] };
}

/** Insert-or-update a single hotel row. */
export async function cloudUpsertTripHotel(hotel: TripHotel): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error } = await client.from("trip_hotels").upsert(hotel, { onConflict: "id" });
  if (error) {
    logCloudFailure("cloudUpsertTripHotel", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

export async function cloudDeleteTripHotel(hotelId: string): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error } = await client.from("trip_hotels").delete().eq("id", hotelId);
  if (error) {
    logCloudFailure("cloudDeleteTripHotel", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

/**
 * List all flights saved for a trip. Best-effort: returns `ok: false` when
 * the cloud client is disabled or the request fails; callers should fall
 * back to their local cache silently (matches the hotel pattern).
 */
export async function cloudListTripFlights(tripId: string): Promise<CloudResult<TripFlight[]>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("trip_flights").select("*").eq("tripId", tripId);
  if (error) {
    logCloudFailure("cloudListTripFlights", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: (data as TripFlight[]) ?? [] };
}

/** Insert-or-update a single flight row. */
export async function cloudUpsertTripFlight(flight: TripFlight): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error } = await client.from("trip_flights").upsert(flight, { onConflict: "id" });
  if (error) {
    logCloudFailure("cloudUpsertTripFlight", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

export async function cloudDeleteTripFlight(flightId: string): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error } = await client.from("trip_flights").delete().eq("id", flightId);
  if (error) {
    logCloudFailure("cloudDeleteTripFlight", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

