import { getSupabaseClient } from "../config/supabaseClient";
import type {
  GroupFlight,
  GroupHotel,
  MemberLogisticsConfirmation,
} from "../types/groupLogistics";

function sb() {
  return getSupabaseClient();
}

function cloudDisabled<T>(fallback: T): T {
  return fallback;
}

function rowToGroupFlight(row: Record<string, unknown>): GroupFlight {
  return {
    id: String(row.id),
    tripId: String(row.tripId),
    direction: row.direction === "departure" ? "departure" : "arrival",
    origin: typeof row.origin === "string" ? row.origin : undefined,
    destination: typeof row.destination === "string" ? row.destination : undefined,
    date: typeof row.date === "string" ? row.date : undefined,
    arrivalTime: typeof row.arrivalTime === "string" ? row.arrivalTime : undefined,
    airline: typeof row.airline === "string" ? row.airline : undefined,
    flightNumber: typeof row.flightNumber === "string" ? row.flightNumber : undefined,
    durationMinutes:
      typeof row.durationMinutes === "number" ? row.durationMinutes : undefined,
  };
}

function rowToGroupHotel(row: Record<string, unknown>): GroupHotel {
  return {
    id: String(row.id),
    tripId: String(row.tripId),
    placeId: typeof row.placeId === "string" ? row.placeId : undefined,
    name: String(row.name ?? ""),
    address: typeof row.address === "string" ? row.address : undefined,
    dayStart: typeof row.dayStart === "number" ? row.dayStart : undefined,
    dayEnd: typeof row.dayEnd === "number" ? row.dayEnd : undefined,
  };
}

function rowToConfirmation(row: Record<string, unknown>): MemberLogisticsConfirmation {
  return {
    id: String(row.id),
    tripId: String(row.tripId),
    memberId: String(row.memberId),
    logisticsType: row.logisticsType === "hotel" ? "hotel" : "flight",
    logisticsId: String(row.logisticsId),
    confirmed: row.confirmed !== false,
    separateDate: typeof row.separateDate === "string" ? row.separateDate : undefined,
    separateArrivalTime:
      typeof row.separateArrivalTime === "string" ? row.separateArrivalTime : undefined,
    separateAirline: typeof row.separateAirline === "string" ? row.separateAirline : undefined,
    separateFlightNumber:
      typeof row.separateFlightNumber === "string" ? row.separateFlightNumber : undefined,
    separateHotelName:
      typeof row.separateHotelName === "string" ? row.separateHotelName : undefined,
    separateHotelAddress:
      typeof row.separateHotelAddress === "string" ? row.separateHotelAddress : undefined,
  };
}

export async function getGroupFlights(tripId: string): Promise<GroupFlight[]> {
  const client = sb();
  if (!client) return cloudDisabled([]);

  const { data, error } = await client
    .from("group_flights")
    .select("*")
    .eq("tripId", tripId)
    .order("direction", { ascending: true })
    .order("createdAt", { ascending: true });

  if (error) {
    console.warn("[groupLogistics] getGroupFlights failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => rowToGroupFlight(row as Record<string, unknown>));
}

export async function saveGroupFlight(
  flight: Omit<GroupFlight, "id">
): Promise<GroupFlight> {
  const client = sb();
  if (!client) throw new Error("Cloud disabled");

  const { data, error } = await client
    .from("group_flights")
    .insert(flight)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save group flight");
  return rowToGroupFlight(data as Record<string, unknown>);
}

export async function updateGroupFlight(
  id: string,
  updates: Partial<GroupFlight>
): Promise<void> {
  const client = sb();
  if (!client) return;

  const { id: _id, tripId: _tripId, ...patch } = updates;
  const { error } = await client.from("group_flights").update(patch).eq("id", id);
  if (error) console.warn("[groupLogistics] updateGroupFlight failed", error.message);
}

export async function deleteGroupFlight(id: string): Promise<void> {
  const client = sb();
  if (!client) return;

  const { error } = await client.from("group_flights").delete().eq("id", id);
  if (error) console.warn("[groupLogistics] deleteGroupFlight failed", error.message);
}

export async function getGroupHotels(tripId: string): Promise<GroupHotel[]> {
  const client = sb();
  if (!client) return cloudDisabled([]);

  const { data, error } = await client
    .from("group_hotels")
    .select("*")
    .eq("tripId", tripId)
    .order("dayStart", { ascending: true });

  if (error) {
    console.warn("[groupLogistics] getGroupHotels failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => rowToGroupHotel(row as Record<string, unknown>));
}

export async function saveGroupHotel(hotel: Omit<GroupHotel, "id">): Promise<GroupHotel> {
  const client = sb();
  if (!client) throw new Error("Cloud disabled");

  const { data, error } = await client
    .from("group_hotels")
    .insert(hotel)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save group hotel");
  return rowToGroupHotel(data as Record<string, unknown>);
}

export async function updateGroupHotel(
  id: string,
  updates: Partial<GroupHotel>
): Promise<void> {
  const client = sb();
  if (!client) return;

  const { id: _id, tripId: _tripId, ...patch } = updates;
  const { error } = await client.from("group_hotels").update(patch).eq("id", id);
  if (error) console.warn("[groupLogistics] updateGroupHotel failed", error.message);
}

export async function deleteGroupHotel(id: string): Promise<void> {
  const client = sb();
  if (!client) return;

  const { error } = await client.from("group_hotels").delete().eq("id", id);
  if (error) console.warn("[groupLogistics] deleteGroupHotel failed", error.message);
}

export async function getMemberConfirmations(
  tripId: string,
  memberId: string
): Promise<MemberLogisticsConfirmation[]> {
  const client = sb();
  if (!client) return cloudDisabled([]);

  const { data, error } = await client
    .from("member_logistics_confirmations")
    .select("*")
    .eq("tripId", tripId)
    .eq("memberId", memberId);

  if (error) {
    console.warn("[groupLogistics] getMemberConfirmations failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => rowToConfirmation(row as Record<string, unknown>));
}

/** All confirmations on a trip (for aggregate flight constraints). */
export async function getTripLogisticsConfirmations(
  tripId: string
): Promise<MemberLogisticsConfirmation[]> {
  const client = sb();
  if (!client) return cloudDisabled([]);

  const { data, error } = await client
    .from("member_logistics_confirmations")
    .select("*")
    .eq("tripId", tripId);

  if (error) {
    console.warn("[groupLogistics] getTripLogisticsConfirmations failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => rowToConfirmation(row as Record<string, unknown>));
}

export async function saveMemberConfirmation(
  confirmation: Omit<MemberLogisticsConfirmation, "id">
): Promise<MemberLogisticsConfirmation> {
  const client = sb();
  if (!client) throw new Error("Cloud disabled");

  const { data, error } = await client
    .from("member_logistics_confirmations")
    .upsert(confirmation, {
      onConflict: "memberId,logisticsType,logisticsId",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save confirmation");
  return rowToConfirmation(data as Record<string, unknown>);
}

export async function updateMemberConfirmation(
  id: string,
  updates: Partial<MemberLogisticsConfirmation>
): Promise<void> {
  const client = sb();
  if (!client) return;

  const {
    id: _id,
    tripId: _tripId,
    memberId: _memberId,
    logisticsType: _lt,
    logisticsId: _lid,
    ...patch
  } = updates;

  const { error } = await client
    .from("member_logistics_confirmations")
    .update(patch)
    .eq("id", id);

  if (error) console.warn("[groupLogistics] updateMemberConfirmation failed", error.message);
}
