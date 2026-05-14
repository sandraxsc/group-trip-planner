import { getSupabaseClient } from "../config/supabaseClient";
import type { Itinerary } from "../types/itinerary";

type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string };

function sb() {
  return getSupabaseClient();
}

export function isItineraryCloudEnabled(): boolean {
  return sb() != null;
}

export async function cloudUpsertTripItinerary(itinerary: Itinerary): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const updatedAt = itinerary.updatedAt ?? itinerary.savedAt ?? new Date().toISOString();
  const row = {
    tripId: itinerary.tripId,
    payload: itinerary,
    updatedAt,
  };

  const { error } = await client.from("trip_itineraries").upsert(row, { onConflict: "tripId" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function cloudGetTripItinerary(tripId: string): Promise<CloudResult<Itinerary | null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("trip_itineraries").select("*").eq("tripId", tripId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, data: null };

  const row = data as { tripId?: string; payload?: Itinerary };
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return { ok: true, data: null };
  const merged: Itinerary = {
    ...payload,
    tripId: payload.tripId || row.tripId || tripId,
  };
  return { ok: true, data: merged };
}
